
import "dotenv/config"
import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient } from "@zerodev/sdk"
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants"
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator"
import { http, createPublicClient, zeroAddress } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"

// Load env vars
const PROJECT_ID = process.env.ZERODEV_PROJECT_ID
const RPC_URL = process.env.RPC_URL || "https://sepolia.drpc.org" // Fallback or strict requirement
if (!PROJECT_ID) throw new Error("ZERODEV_PROJECT_ID missing in .env")

// Using User's Sepolia Project ID instead of baseSepolia demo ID
const ZERODEV_RPC = `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/11155111`

const chain = sepolia
const entryPoint = getEntryPoint("0.7")
const kernelVersion = KERNEL_V3_1

const main = async () => {
    try {
        // Construct a signer
        // Note: Using a fresh key each time as per docs example, or we could load from env if preferred.
        // Docs say 'generatePrivateKey', so we leave it as is for exact reproduction.
        const privateKey = generatePrivateKey()
        const signer = privateKeyToAccount(privateKey)
        console.log(" Generated new signer:", signer.address)

        // Construct a public client
        const publicClient = createPublicClient({
            // Use your own RPC provider in production (e.g. Infura/Alchemy).
            transport: http(RPC_URL),
            chain
        })

        // Construct a validator
        const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
            signer,
            entryPoint,
            kernelVersion
        })

        // Construct a Kernel account
        const account = await createKernelAccount(publicClient, {
            plugins: {
                sudo: ecdsaValidator,
            },
            entryPoint,
            kernelVersion
        })

        const zerodevPaymaster = createZeroDevPaymasterClient({
            chain,
            transport: http(ZERODEV_RPC),
        })

        // Construct a Kernel account client
        const kernelClient = createKernelAccountClient({
            account,
            chain,
            bundlerTransport: http(ZERODEV_RPC),
            // Required - the public client
            client: publicClient,
            paymaster: {
                getPaymasterData(userOperation) {
                    return zerodevPaymaster.sponsorUserOperation({ userOperation })
                }
            },
        })

        const accountAddress = kernelClient.account.address
        console.log("My account:", accountAddress)

        // Send a UserOp
        const userOpHash = await kernelClient.sendUserOperation({
            callData: await kernelClient.account.encodeCalls([{
                to: zeroAddress,
                value: BigInt(0),
                data: "0x",
            }]),
        })

        console.log("UserOp hash:", userOpHash)
        console.log("Waiting for UserOp to complete...")

        const receipt = await kernelClient.waitForUserOperationReceipt({
            hash: userOpHash,
            timeout: 1000 * 60, // Increased timeout for safety
        })

        console.log("✅ UserOp confirmed!")
        console.log("🔗 View on Jiffyscan: https://jiffyscan.xyz/userOpHash/" + userOpHash)
        console.log("🔗 View on Etherscan: https://sepolia.etherscan.io/tx/" + receipt.receipt.transactionHash)

        process.exit()
    } catch (error) {
        console.error("❌ Error running index.ts:", error)
        process.exit(1)
    }
}

main()
