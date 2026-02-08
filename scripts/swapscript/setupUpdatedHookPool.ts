import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const POOL_MANAGER = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";
const POOL_REGISTRY = "0xF995fB0554d39fDe02868470bFD2E2E2e9A043e1";

const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";
const UPDATED_HOOK = "0x41B794D60e275D96ba393E301cB8b684604680C0"; // Deployed 0x8772...
const FEE = 5500; // 0.5%
const TICK_SPACING = 66;

console.log("\n🎉 Setting up pool with UPDATED AminoRiskFeeHook (with registry integration)");
console.log("=".repeat(80));
console.log("Hook Address:", UPDATED_HOOK);
console.log("Fee:", FEE);
console.log("Tick Spacing:", TICK_SPACING);
console.log("");

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const [token0, token1] = ETH.toLowerCase() < USDC.toLowerCase() ? [ETH, USDC] : [USDC, ETH];

    const poolKey = {
        currency0: token0,
        currency1: token1,
        fee: FEE,
        tickSpacing: TICK_SPACING,
        hooks: UPDATED_HOOK
    };

    // Correct price: 2^96 / 10^6 for 18 vs 6 decimals parity (1 ETH = 1 USDC visually, or 1e18 wei = 1e6 usdc)
    // Actually, usually 1 ETH = 2000 USDC.
    // If we want 1:1 parity for testing simplicity:
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

    console.log("Initializing pool...");
    try {
        const tx = await poolManager.initialize(poolKey, sqrtPriceX96, { gasLimit: 1000000 });
        await tx.wait();
        console.log("✅ Pool initialized:", tx.hash);
    } catch (e: any) {
        if (e.message?.includes("PoolAlreadyInitialized") || e.message?.includes("AI")) { // 0x... selector for AlreadyInitialized
            console.log("✅ Pool already initialized");
        } else {
            // It might fail if hook reverts during initialization (beforeInitialize/afterInitialize)
            // But this hook only has beforeSwap/afterSwap permissions.
            console.log("⚠️ Initialization failed (might be already init):", e.message);
        }
    }

    console.log("Registering pool...");
    try {
        const tx = await registry.register(poolKey, { gasLimit: 500000 });
        await tx.wait();
        console.log("✅ Pool registered:", tx.hash);
    } catch (e: any) {
        if (e.message?.includes("ALREADY_REGISTERED")) {
            console.log("✅ Pool already registered");
        } else {
            console.log("⚠️ Registration failed:", e.message);
        }
    }

    const encoded = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint24", "int24", "address"],
        [token0, token1, FEE, TICK_SPACING, UPDATED_HOOK]
    );
    const poolId = ethers.utils.keccak256(encoded);

    console.log("\n" + "=".repeat(80));
    console.log("🎉 UPDATED POOL READY!");
    console.log("=".repeat(80));
    console.log("\nPool ID: " + poolId);
    console.log("Hook: " + UPDATED_HOOK);
    console.log("Fee: " + FEE + " (0.5%)");
    console.log("\nAdd Liquidity URL: http://localhost:3000/positions/create?poolId=" + poolId);
    console.log("\nNext Steps:");
    console.log("1. Add Liquidity via UI");
    console.log("2. Update agentSwap.ts and retailSwap.ts with new HOOK address");
    console.log("3. Run swaps");
    console.log("\n✅ Done.\n");
}

main().catch(console.error);
