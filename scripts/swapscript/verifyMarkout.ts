
import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const HOOK_ADDRESS = "0x760A4386bc0D027d65E5CD017aC492c40D6640c0";

async function main() {
    const txHash = process.argv[2];
    if (!txHash) {
        console.error("Usage: bun scripts/verifyMarkout.ts <TX_HASH>");
        process.exit(1);
    }

    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("🔍 analyzing swap transaction:", txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
        console.error("Transaction not found!");
        process.exit(1);
    }

    // 1. Find SwapRecorded event to get swapId
    // Event: SwapRecorded(bytes32 indexed swapId, ...)
    // Topic0: keccak256("SwapRecorded(bytes32,bytes32,address,uint256,uint160,uint160,uint24,uint256)")
    // Actually, let's just use the interface to parse logs.

    const HOOK_ABI = [
        "event SwapRecorded(bytes32 indexed swapId, bytes32 indexed poolId, address indexed sender, uint256 agentId, uint160 sqrtPriceBeforeX96, uint160 sqrtPriceAfterX96, uint24 feeBps, uint256 Rnow)",
        "event MarkoutChecked(bytes32 indexed swapId, uint256 rho1e18)",
        "function verifyMarkout(bytes32 swapId) external returns (uint256 rho1e18)"
    ];

    const hook = new ethers.Contract(HOOK_ADDRESS, HOOK_ABI, wallet);

    let swapId = null;
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === HOOK_ADDRESS.toLowerCase()) {
            try {
                const parsed = hook.interface.parseLog(log);
                if (parsed.name === "SwapRecorded") {
                    swapId = parsed.args.swapId;
                    console.log("✅ Found SwapID:", swapId);
                    break;
                }
            } catch (e) { }
        }
    }

    if (!swapId) {
        console.error("❌ No SwapRecorded event found in this transaction.");
        process.exit(1);
    }

    console.log("⏳ Checking if enough blocks have passed...");
    const currentBlock = await provider.getBlockNumber();
    const swapBlock = receipt.blockNumber;
    const blocksPassed = currentBlock - swapBlock;

    console.log(`   Swap Block: ${swapBlock}`);
    console.log(`   Current Block: ${currentBlock}`);
    console.log(`   Diff: ${blocksPassed} / 10 required`);

    if (blocksPassed < 10) {
        console.log("⚠️ Not enough blocks passed. Cannot verify markout yet.");
        console.log("   (On local testnet, trigger blocks manually. On Sepolia, wait ~2 mins)");
        return;
    }

    console.log("\n🚀 Calling verifyMarkout()...");
    try {
        // Try static call first to get revert reason
        try {
            await hook.callStatic.verifyMarkout(swapId);
        } catch (e: any) {
            console.log("⚠️ Static Call Failed:", e.reason || e.message);
        }

        const tx = await hook.verifyMarkout(swapId, { gasLimit: 500000 });
        console.log("   Tx sent:", tx.hash);
        const receipt2 = await tx.wait();

        // Check for Slash event (from Registry, not Hook directly, or MarkoutChecked from Hook)
        // MarkoutChecked IS emitted by Hook.
        // Registry.slash IS called, which might emit an event from Registry.

        let markoutRho = null;
        for (const log of receipt2.logs) {
            if (log.address.toLowerCase() === HOOK_ADDRESS.toLowerCase()) {
                try {
                    const parsed = hook.interface.parseLog(log);
                    if (parsed.name === "MarkoutChecked") {
                        markoutRho = parsed.args.rho1e18.toString();
                        console.log("✅ EVENT: MarkoutChecked");
                        console.log("   rho (volatility):", ethers.utils.formatUnits(markoutRho, 18));
                    }
                } catch (e) { }
            }
        }

        if (markoutRho && ethers.BigNumber.from(markoutRho).lt("200000000000000000")) { // 0.2
            console.log("\n⚠️ VOLATILITY LOW (< 0.2) -> SLASHING CONDITION MET!");
            console.log("   (If AgentID was valid and Registry linked, a slash call occurred)");
        } else {
            console.log("\n✅ Volatility Healthy. No Slashing.");
        }

    } catch (e: any) {
        console.error("❌ verifyMarkout failed:", e.reason || e.message);
    }
}

main();
