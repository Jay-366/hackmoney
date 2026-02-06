
import "dotenv/config"
import { createKernelAccount } from "@zerodev/sdk"
import { KERNEL_V3_1, getEntryPoint } from "@zerodev/sdk/constants"
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator"
import { http, createPublicClient, formatEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"

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
        const publicClient = createPublicClient({
            transport: http(RPC_URL),
            chain
        })

        // Reconstruct the Owner Account to get the deterministic address
        const ownerAccount = privateKeyToAccount(PRIVATE_KEY as `0x${string}`)
        const ownerEcdsaValidator = await signerToEcdsaValidator(publicClient, {
            signer: ownerAccount,
            entryPoint,
            kernelVersion
        })

        const account = await createKernelAccount(publicClient, {
            plugins: {
                sudo: ownerEcdsaValidator,
            },
            entryPoint,
            kernelVersion
        })

        const address = account.address
        console.log("\n🏦 Smart Account Balance Check")
        console.log("--------------------------------------------------")
        console.log("📜 Address:", address)

        // Fetch Balance
        const balance = await publicClient.getBalance({ address })
        console.log("💰 Balance:", formatEther(balance), "ETH")
        console.log("--------------------------------------------------")
        console.log("\nTo add funds:")
        console.log("1. Copy the address above.")
        console.log("2. Send Sepolia ETH from your EOA (MetaMask) or a Faucet.")
        console.log("   - Faucet: https://sepoliafaucet.com/")
        console.log("   - Faucet: https://www.alchemy.com/faucets/ethereum-sepolia")

        process.exit(0)
    } catch (e) {
        console.error("❌ Error:", e)
        process.exit(1)
    }
}

main()
