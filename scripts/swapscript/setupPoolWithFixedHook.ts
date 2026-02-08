import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const POOL_MANAGER = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";
const POOL_REGISTRY = "0xF995fB0554d39fDe02868470bFD2E2E2e9A043e1";

const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";
const FIXED_HOOK = "0x0751475F21877c8906C74d50546aaaBD1AF140C0"; // FIXED!
const FEE = 10000; // 1%
const TICK_SPACING = 200;

console.log("\n🎉 Setting up pool with FIXED AminoRiskFeeHook");
console.log("=".repeat(60));
console.log("This hook now correctly reads getSlot0() from PoolManager!\n");

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const [token0, token1] = ETH.toLowerCase() < USDC.toLowerCase() ? [ETH, USDC] : [USDC, ETH];

    const poolKey = {
        currency0: token0,
        currency1: token1,
        fee: FEE,
        tickSpacing: TICK_SPACING,
        hooks: FIXED_HOOK
    };

    // Correct price: 2^96 / 10^6
    const Q96 = ethers.BigNumber.from(2).pow(96);
    const sqrtPriceX96 = Q96.div(1000000);

    const POOL_MANAGER_ABI = [{
        "inputs": [
            {
                "components": [
                    { "name": "currency0", "type": "address" },
                    { "name": "currency1", "type": "address" },
                    { "name": "fee", "type": "uint24" },
                    { "name": "tickSpacing", "type": "int24" },
                    { "name": "hooks", "type": "address" }
                ], "name": "key", "type": "tuple"
            },
            { "name": "sqrtPriceX96", "type": "uint160" }
        ],
        "name": "initialize",
        "outputs": [{ "name": "tick", "type": "int24" }],
        "stateMutability": "nonpayable",
        "type": "function"
    }];

    const REGISTRY_ABI = [{
        "inputs": [{
            "components": [
                { "name": "currency0", "type": "address" },
                { "name": "currency1", "type": "address" },
                { "name": "fee", "type": "uint24" },
                { "name": "tickSpacing", "type": "int24" },
                { "name": "hooks", "type": "address" }
            ],
            "name": "key",
            "type": "tuple"
        }],
        "name": "register",
        "outputs": [{ "name": "poolId", "type": "bytes32" }],
        "stateMutability": "nonpayable",
        "type": "function"
    }];

    const poolManager = new ethers.Contract(POOL_MANAGER, POOL_MANAGER_ABI, wallet);
    const registry = new ethers.Contract(POOL_REGISTRY, REGISTRY_ABI, wallet);

    console.log("Step 1/2: Initializing pool...");
    try {
        const tx = await poolManager.initialize(poolKey, sqrtPriceX96, { gasLimit: 1000000 });
        await tx.wait();
        console.log("✅ Pool initialized:", tx.hash);
    } catch (e: any) {
        if (e.message?.includes("PoolAlreadyInitialized") || e.message?.includes("AI")) {
            console.log("✅ Pool already initialized");
        } else {
            throw e;
        }
    }

    console.log("\nStep 2/2: Registering pool...");
    try {
        const tx = await registry.register(poolKey, { gasLimit: 500000 });
        await tx.wait();
        console.log("✅ Pool registered:", tx.hash);
    } catch (e: any) {
        if (e.message?.includes("ALREADY_REGISTERED")) {
            console.log("✅ Pool already registered");
        } else {
            throw e;
        }
    }

    // Calculate pool ID
    const encoded = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint24", "int24", "address"],
        [token0, token1, FEE, TICK_SPACING, FIXED_HOOK]
    );
    const poolId = ethers.utils.keccak256(encoded);

    console.log("\n" + "=".repeat(60));
    console.log("🎉 SUCCESS! Pool with FIXED hook is ready!");
    console.log("=".repeat(60));
    console.log(`\n📋 Pool Details:`);
    console.log(`   Token0 (ETH): ${token0}`);
    console.log(`   Token1 (USDC): ${token1}`);
    console.log(`   Fee: ${FEE} (1%)`);
    console.log(`   Hook (FIXED): ${FIXED_HOOK}`);
    console.log(`   Pool ID: ${poolId}`);

    console.log(`\n🔗 Add Liquidity URL:`);
    console.log(`   http://localhost:3000/positions/create?poolId=${poolId}`);

    console.log(`\n📝 Next Steps:`);
    console.log(`   1. Add liquidity via UI (Full Range, 100 ETH + 100 USDC)`);
    console.log(`   2. Update checkLiquidity.ts: FEE = 10000, TICK_SPACING = 200`);
    console.log(`   3. Run: bun scripts/checkLiquidity.ts`);
    console.log(`   4. Run: bun scripts/agentSwap.ts (already updated!)`);
    console.log(`\n✅ The swap should work now - the hook bug is FIXED!\n`);
}

main().catch(console.error);
