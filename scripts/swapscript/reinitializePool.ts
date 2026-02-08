import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const POOL_MANAGER = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";

const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";
const HOOK = "0x8E5AA11AD9165E247a2c8C12d3a3f873BA4340c0";
const FEE = 3000;
const TICK_SPACING = 6;

const POOL_MANAGER_ABI = [
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "address", "name": "currency0", "type": "address" },
                    { "internalType": "address", "name": "currency1", "type": "address" },
                    { "internalType": "uint24", "name": "fee", "type": "uint24" },
                    { "internalType": "int24", "name": "tickSpacing", "type": "int24" },
                    { "internalType": "address", "name": "hooks", "type": "address" }
                ],
                "internalType": "struct PoolKey",
                "name": "key",
                "type": "tuple"
            },
            { "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160" }
        ],
        "name": "initialize",
        "outputs": [{ "internalType": "int24", "name": "tick", "type": "int24" }],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log("Using Wallet:", wallet.address);

    // Sort tokens
    const [token0, token1] = ETH.toLowerCase() < USDC.toLowerCase() ? [ETH, USDC] : [USDC, ETH];

    const poolKey = {
        currency0: token0,
        currency1: token1,
        fee: FEE,
        tickSpacing: TICK_SPACING,
        hooks: HOOK
    };

    // Calculate sqrtPriceX96 for a reasonable price
    // For 1 ETH = 3000 USDC:
    // Price = 3000 (USDC per ETH)
    // But we need to account for decimals: ETH has 18, USDC has 6
    // So the actual ratio in wei is: 1e18 ETH = 3000e6 USDC
    // Price = 3000e6 / 1e18 = 3000 / 1e12 = 0.000003

    // For simplicity, let's use 1:1 in token units (1 ETH = 1 USDC, ignoring decimals)
    // This means: 1e18 wei ETH = 1e6 wei USDC
    // Price = 1e6 / 1e18 = 1e-12
    // sqrtPrice = sqrt(1e-12) = 1e-6
    // sqrtPriceX96 = 1e-6 * 2^96 = 79228162514264337593543950336 * 1e-6

    // Actually, let's use a 1:1 ratio in WEI terms for simplicity
    // Price = 1 (1 wei token0 = 1 wei token1)
    // sqrtPrice = 1
    // sqrtPriceX96 = 2^96 = 79228162514264337593543950336

    const sqrtPriceX96 = "79228162514264337593543950336"; // This is 2^96, representing 1:1 price

    console.log("\n🔄 Reinitializing pool with 1:1 price ratio...");
    console.log(`Token0: ${token0}`);
    console.log(`Token1: ${token1}`);
    console.log(`sqrtPriceX96: ${sqrtPriceX96}`);

    const poolManager = new ethers.Contract(POOL_MANAGER, POOL_MANAGER_ABI, wallet);

    try {
        const tx = await poolManager.initialize(poolKey, sqrtPriceX96, {
            gasLimit: 1000000
        });
        console.log("\n✅ Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Pool reinitialized! Block:", receipt.blockNumber);
        console.log("\nNow try adding liquidity again via the UI with Full Range checked.");
    } catch (error: any) {
        if (error.message?.includes("PoolAlreadyInitialized") || error.message?.includes("AI")) {
            console.log("\n⚠️  Pool is already initialized. Cannot reinitialize.");
            console.log("\n💡 ALTERNATIVE: Use a different fee tier to create a new pool:");
            console.log("   - Current pool uses fee=3000 (0.3%)");
            console.log("   - Try fee=500 (0.05%) or fee=10000 (1%) for a fresh pool");
            console.log("\nOr, just reduce the swap amount to match the tiny liquidity:");
            console.log("   Update agentSwap.ts line 58:");
            console.log('   const amountInWei = "67037375434"; // 1% of current liquidity');
        } else {
            console.error("Error:", error);
        }
    }
}

main().catch(console.error);
