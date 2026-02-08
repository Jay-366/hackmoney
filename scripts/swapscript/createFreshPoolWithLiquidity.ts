import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

// Use a different fee tier to create a NEW pool
const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";
const HOOK = "0x41B794D60e275D96ba393E301cB8b684604680C0";
const POOL_MANAGER = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";

// Use a DIFFERENT fee tier (3000 = 0.3%) to create a fresh pool
const NEW_FEE = 3000;  // 0.3% fee
const NEW_TICK_SPACING = 60;

// 1:1 price for 18-decimal:6-decimal = 10^12
// sqrtPriceX96 = sqrt(10^12) * 2^96 = 10^6 * 2^96
// = 79228162514264337593543950336000000
const SQRT_PRICE_X96_1_TO_1 = "79228162514264337593543950336000000";

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("Creating a FRESH pool with 0.3% fee...");
    console.log("Wallet:", wallet.address);

    const [token0, token1] = ETH.toLowerCase() < USDC.toLowerCase() ? [ETH, USDC] : [USDC, ETH];

    console.log("\nPool Parameters:");
    console.log("  Token0:", token0);
    console.log("  Token1:", token1);
    console.log("  Fee:", NEW_FEE, "(0.3%)");
    console.log("  Tick Spacing:", NEW_TICK_SPACING);
    console.log("  Hook:", HOOK);

    // Compute Pool ID
    const encoded = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint24", "int24", "address"],
        [token0, token1, NEW_FEE, NEW_TICK_SPACING, HOOK]
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
                fee: NEW_FEE,
                tickSpacing: NEW_TICK_SPACING,
                hooks: HOOK
            },
            SQRT_PRICE_X96_1_TO_1,
            { gasLimit: 500000 }
        );
        console.log("TX:", tx.hash);
        await tx.wait();
        console.log("✅ Pool initialized!");
    } catch (e: any) {
        if (e.message.includes("already initialized")) {
            console.log("Pool already exists, that's fine.");
        } else {
            console.log("Error:", e.message);
            return;
        }
    }

    console.log("\n=====================================");
    console.log("✅ NEW POOL READY");
    console.log("=====================================");
    console.log("Pool ID:", poolId);
    console.log("Fee:", NEW_FEE, "(0.3%)");
    console.log("Hook:", HOOK);
    console.log("\n1. Add Liquidity: http://localhost:3000/positions/create?poolId=" + poolId);
    console.log("\n2. Update agentSwap.ts with:");
    console.log(`   const FEE = ${NEW_FEE};`);
    console.log(`   const TICK_SPACING = ${NEW_TICK_SPACING};`);
}

main().catch(console.error);
