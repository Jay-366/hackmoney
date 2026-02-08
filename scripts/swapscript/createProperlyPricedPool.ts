import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";
const HOOK = "0x41B794D60e275D96ba393E301cB8b684604680C0";
const POOL_MANAGER = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";

// Use fee tier 1000 (0.1%) - different from previous pools
const FEE = 1000;
const TICK_SPACING = 60;

// For ETH (18 decimals) and USDC (6 decimals):
// If we want 1 ETH = 1000 USDC (realistic price):
// price = 1000 * 10^6 / 10^18 = 10^-9
// sqrtPrice = sqrt(10^-9) ≈ 0.0000316
// sqrtPriceX96 = 0.0000316 * 2^96 ≈ 2.5 * 10^24
// 
// For 1 ETH = 1 USDC (test scenario):
// price = 1 * 10^6 / 10^18 = 10^-12
// sqrtPrice = sqrt(10^-12) = 10^-6
// sqrtPriceX96 = 10^-6 * 2^96 = 79228162514264337593
const SQRT_PRICE_X96 = "79228162514264337593"; // 1 ETH ≈ 1 USDC (for testing)

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("Creating a properly priced pool with 0.1% fee...");
    console.log("Wallet:", wallet.address);

    const [token0, token1] = ETH.toLowerCase() < USDC.toLowerCase() ? [ETH, USDC] : [USDC, ETH];

    console.log("\nPool Parameters:");
    console.log("  Token0 (ETH):", token0);
    console.log("  Token1 (USDC):", token1);
    console.log("  Fee:", FEE, "(0.1%)");
    console.log("  Tick Spacing:", TICK_SPACING);
    console.log("  Hook:", HOOK);
    console.log("  SqrtPriceX96:", SQRT_PRICE_X96);

    // Compute Pool ID
    const encoded = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint24", "int24", "address"],
        [token0, token1, FEE, TICK_SPACING, HOOK]
    );
    const poolId = ethers.utils.keccak256(encoded);
    console.log("\nNew Pool ID:", poolId);

    // Initialize Pool
    const poolManagerAbi = [
        "function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks), uint160 sqrtPriceX96) external returns (int24)"
    ];
    const poolManager = new ethers.Contract(POOL_MANAGER, poolManagerAbi, wallet);

    try {
        console.log("\nInitializing pool...");
        const tx = await poolManager.initialize(
            {
                currency0: token0,
                currency1: token1,
                fee: FEE,
                tickSpacing: TICK_SPACING,
                hooks: HOOK
            },
            SQRT_PRICE_X96,
            { gasLimit: 500000 }
        );
        console.log("TX:", tx.hash);
        await tx.wait();
        console.log("✅ Pool initialized!");
    } catch (e: any) {
        if (e.message.includes("already initialized")) {
            console.log("Pool already exists.");
        } else {
            console.log("Error:", e.message);
            return;
        }
    }

    console.log("\n=====================================");
    console.log("✅ PROPERLY PRICED POOL READY");
    console.log("=====================================");
    console.log("Pool ID:", poolId);
    console.log("Fee:", FEE, "(0.1%)");
    console.log("Hook:", HOOK);
    console.log("\n1. Add Liquidity: http://localhost:3000/positions/create?poolId=" + poolId);
    console.log("\n2. Update agentSwap.ts with:");
    console.log(`   const FEE = ${FEE};`);
    console.log(`   const TICK_SPACING = ${TICK_SPACING};`);
    console.log("\n3. Run swap (use small amounts!):");
    console.log("   bun scripts/agentSwap.ts");
}

main().catch(console.error);
