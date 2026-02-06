
import "dotenv/config"
import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient } from "@zerodev/sdk"
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants"
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator"
import { toPermissionValidator, serializePermissionAccount, deserializePermissionAccount } from "@zerodev/permissions"
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
const ZERODEV_RPC = `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/11155111`

const main = async () => {
    try {
        console.log("🚀 Serialized Session Key Test")

        const publicClient = createPublicClient({
            transport: http(RPC_URL),
            chain
        })
        const zerodevPaymaster = createZeroDevPaymasterClient({
            chain,
            transport: http(ZERODEV_RPC),
        })

        // ===================================
        // 🔒 ROLE 1: OWNER (Setup & Approve)
        // ===================================
        console.log("\n👑 1. OWNER: Creating Approval...")

        // Owner Signer
        const ownerAccount = privateKeyToAccount(PRIVATE_KEY as `0x${string}`)
        const ownerEcdsaValidator = await signerToEcdsaValidator(publicClient, {
            signer: ownerAccount,
            entryPoint,
            kernelVersion
        })

        // Agent Signer (The "Session Key") - In reality, Agent sends public key to Owner
        const sessionPrivateKey = generatePrivateKey()
        const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey)
        const sessionKeySigner = await toECDSASigner({
            signer: sessionKeyAccount
        })
        console.log("   Agent Key Generated:", sessionKeyAccount.address)

        // Policy
        const callPolicy = toCallPolicy({
            policyVersion: CallPolicyVersion.V0_0_4,
            permissions: [
                {
                    target: zeroAddress,
                    valueLimit: BigInt(0),
                },
            ],
        })

        // Permission Validator (The Plugin)
        const permissionPlugin = await toPermissionValidator(publicClient, {
            entryPoint,
            kernelVersion,
            signer: sessionKeySigner,
            policies: [callPolicy],
        })

        // Owner creates the account *view* with this plugin to sign enablement
        const sessionAccount = await createKernelAccount(publicClient, {
            plugins: {
                sudo: ownerEcdsaValidator,
                regular: permissionPlugin,
            },
            entryPoint,
            kernelVersion
        })

        // SERIALIZE: This generates the "Approval String" containing the Sudo signature
        console.log("   Serializing Approval...")
        const approval = await serializePermissionAccount(sessionAccount)
        console.log("   📦 Approval String Length:", approval.length)


        // ===================================
        // 🤖 ROLE 2: AGENT (Restore & Act)
        // ===================================
        console.log("\n🤖 2. AGENT: Restoring Account from Approval...")

        // Agent strictly uses `deserializePermissionAccount`
        // They do NOT have access to `ownerEcdsaValidator` or `PRIVATE_KEY` here
        const agentAccount = await deserializePermissionAccount(publicClient, entryPoint, kernelVersion, approval, sessionKeySigner)
        console.log("   Agent Account Address:", agentAccount.address)

        const agentClient = createKernelAccountClient({
            account: agentAccount,
            chain,
            bundlerTransport: http(ZERODEV_RPC),
            client: publicClient as any, // Cast to any for type compatibility
            paymaster: {
                getPaymasterData(userOperation) {
                    return zerodevPaymaster.sponsorUserOperation({ userOperation })
                }
            },
        })

        console.log("\n🚗 3. AGENT: Sending Transaction...")
        const userOpHash = await agentClient.sendUserOperation({
            callData: await agentClient.account.encodeCalls([{
                to: zeroAddress,
                value: BigInt(0),
                data: "0x",
            }]),
        } as any)

        console.log("   ✅ UserOp Hash:", userOpHash)
        console.log("   ⏳ Waiting for receipt...")

        const receipt = await agentClient.waitForUserOperationReceipt({
            hash: userOpHash,
            timeout: 1000 * 60,
        })

        console.log("\n🎉 SUCCESS! Session Key Transaction Confirmed.")
        console.log("   🔗 Etherscan:", "https://sepolia.etherscan.io/tx/" + receipt.receipt.transactionHash)

        process.exit(0)
    } catch (e: any) {
        console.error("❌ Error Type:", typeof e)
        console.error("❌ Error Name:", e.name)
        console.error("❌ Error Message:", e.message)
        // console.error("Stack:", e.stack) 
        process.exit(1)
    }
}

main()
