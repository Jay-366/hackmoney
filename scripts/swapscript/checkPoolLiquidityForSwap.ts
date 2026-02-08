import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;

const ETH = "0x209a45e3242a2985ba5701e07615b441ff2593c9";
const USDC = "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435";
const HOOK = "0x41B794D60e275D96ba393E301cB8b684604680C0";
const FEE = 5500;
const TICK_SPACING = 66;

const [token0, token1] = ETH.toLowerCase() < USDC.toLowerCase() ? [ETH, USDC] : [USDC, ETH];

const encoded = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "uint24", "int24", "address"],
    [token0, token1, FEE, TICK_SPACING, HOOK]
);
const poolId = ethers.utils.keccak256(encoded);

console.log("Pool Parameters:");
console.log("  Token0:", token0);
console.log("  Token1:", token1);
console.log("  Fee:", FEE);
console.log("  TickSpacing:", TICK_SPACING);
console.log("  Hook:", HOOK);
console.log("\nPool ID:", poolId);
console.log("\n📝 This is the pool we're trying to swap on.");
console.log("Expected pool ID from setupFinalPool.ts: 0xfafd52d25eb15772692688482a0b58ed7025ff9376c6043d0c569e166e5bbe61");

async function checkLiquidity() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);

    const STATE_VIEW = process.env.NEXT_PUBLIC_STATE_VIEW || "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c";
    const abi = [{
        "inputs": [{ "name": "poolManager", "type": "address" }, { "name": "poolId", "type": "bytes32" }],
        "name": "getLiquidity",
        "outputs": [{ "name": "", "type": "uint128" }],
        "stateMutability": "view",
        "type": "function"
    }];

    const stateView = new ethers.Contract(STATE_VIEW, abi, provider);
    const POOL_MANAGER = process.env.NEXT_PUBLIC_V4_POOL_MANAGER || "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";

    // 1. Check Slot0 via StateView
    const svAbi = [
        "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
        "function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity)"
    ];
    const stateViewContract = new ethers.Contract(STATE_VIEW, svAbi, provider);

    try {
        console.log("Checking Slot0 via StateView...");
        const slot0 = await stateViewContract.getSlot0(poolId);
        console.log("✅ Slot0:", {
            sqrtPriceX96: slot0.sqrtPriceX96.toString(),
            tick: slot0.tick.toString(),
            protocolFee: slot0.protocolFee.toString(),
            lpFee: slot0.lpFee.toString()
        });
    } catch (e: any) {
        console.log("❌ Slot0 check failed:", e.message);
        return;
    }

    try {
        const liquidity = await stateViewContract.getLiquidity(poolId);
        console.log("\n✅ Liquidity:", liquidity.toString());

        if (liquidity.toString() === "0") {
            console.log("\n❌ PROBLEM: This pool has ZERO liquidity!");
            console.log("You need to add liquidity to this pool before swapping.");
            console.log("URL: http://localhost:3000/positions/create?poolId=" + poolId);
        }
    } catch (e: any) {
        console.log("\n❌ Failed to check liquidity:", e.message);
    }
}

checkLiquidity().catch(console.error);
