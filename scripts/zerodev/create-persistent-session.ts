
import "dotenv/config"
import { createKernelAccount } from "@zerodev/sdk"
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants"
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator"
import { toPermissionValidator, serializePermissionAccount } from "@zerodev/permissions"
import { toECDSASigner } from "@zerodev/permissions/signers"
import { toCallPolicy, CallPolicyVersion } from "@zerodev/permissions/policies"
import { http, createPublicClient, zeroAddress, parseEther } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"

// 1. Setup Env
const PROJECT_ID = process.env.ZERODEV_PROJECT_ID
const RPC_URL = process.env.RPC_URL || "https://sepolia.drpc.org"
let PRIVATE_KEY = process.env.PRIVATE_KEY

if (!PROJECT_ID || !PRIVATE_KEY) throw new Error("Missing env vars")
if (!PRIVATE_KEY.startsWith("0x")) PRIVATE_KEY = `0x${PRIVATE_KEY}`

const chain = sepolia
const entryPoint = getEntryPoint("0.7")
const kernelVersion = KERNEL_V3_1

const main = async () => {
    try {
        console.log("🚀 Generating Persistent Session Credentials...")

        const publicClient = createPublicClient({
            transport: http(RPC_URL),
            chain
        })

        // A. Owner (Master)
        const ownerAccount = privateKeyToAccount(PRIVATE_KEY as `0x${string}`)
        const ownerEcdsaValidator = await signerToEcdsaValidator(publicClient, {
            signer: ownerAccount,
            entryPoint,
            kernelVersion
        })

        // B. Agent (Persistent Session Key)
        // We generate a NEW random key here, which will become the Agent's permanent identity
        const sessionPrivateKey = generatePrivateKey()
        const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey)
        const sessionKeySigner = await toECDSASigner({
            signer: sessionKeyAccount
        })

        // C. Define Policy
        const targetAddress = "0xcFcF607971ad68AE5E0FBCea64d129449adf7Cd1"
        const callPolicy = toCallPolicy({
            policyVersion: CallPolicyVersion.V0_0_4,
            permissions: [
                {
                    target: zeroAddress,
                    valueLimit: BigInt(0),
                },
                {
                    target: targetAddress,
                    valueLimit: parseEther("0.1"), // Allow up to 0.1 ETH
                }
            ],
        })

        // D. Create Permission Validator
        const permissionPlugin = await toPermissionValidator(publicClient, {
            entryPoint,
            kernelVersion,
            signer: sessionKeySigner,
            policies: [callPolicy],
        })

        // E. Create Account View & Serialize
        const sessionAccount = await createKernelAccount(publicClient, {
            plugins: {
                sudo: ownerEcdsaValidator,
                regular: permissionPlugin,
            },
            entryPoint,
            kernelVersion
        })

        const approval = await serializePermissionAccount(sessionAccount)

        console.log("\n✅ Credentials Generated!")

        // AUTO-SAVE to test-agent/.env
        const fs = require('fs');
        const path = require('path');
        const envPath = path.join(__dirname, '../test-agent/.env');

        let envContent = fs.readFileSync(envPath, 'utf8');

        // Append if not exists
        if (!envContent.includes("SESSION_KEY_PRIVATE")) {
            envContent += `\n\n# ZeroDev Session Credentials (Auto-generated)\n`;
            envContent += `ZERODEV_PROJECT_ID=${PROJECT_ID}\n`;
            envContent += `SESSION_KEY_PRIVATE=${sessionPrivateKey}\n`;
            envContent += `SESSION_APPROVAL=${approval}\n`;

            fs.writeFileSync(envPath, envContent);
            console.log(`\n✅ Automatically appended credentials to: ${envPath}`);
        } else {
            console.log(`\n⚠️ Credentials already exist in ${envPath}. Skipping append.`);
            console.log("If you want to regenerate, delete the SESSION lines from that file.");
        }

        console.log(`\nAgent Address: ${sessionAccount.address}`)

        process.exit(0)
    } catch (e) {
        console.error("❌ Error:", e)
        process.exit(1)
    }
}

main()
