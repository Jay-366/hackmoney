import { ethers } from "ethers";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
let AGENT_KEY = "dac64655d0b78804819c9a29c50038f49eba94619bd348eb3bd4676d2c3b712f";
if (!AGENT_KEY.startsWith("0x")) AGENT_KEY = `0x${AGENT_KEY}`;

const UNIVERSAL_ROUTER = "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

const UNIVERSAL_ROUTER_ABI = [
    {
        inputs: [
            { internalType: "bytes", name: "commands", type: "bytes" },
            { internalType: "bytes[]", name: "inputs", type: "bytes[]" },
            { internalType: "uint256", name: "deadline", type: "uint256" },
        ],
        name: "execute",
        outputs: [],
        stateMutability: "payable",
        type: "function",
    },
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
];

const ETH = { address: "0x209a45e3242a2985ba5701e07615b441ff2593c9", decimals: 18 };
const USDC = { address: "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435", decimals: 6 };
const HOOK = "0x87722c424B5d9C9b9D6113198b38D668C954C0C0";
const FEE = 5000;
const TICK_SPACING = 60;

// Test amounts for different tiers
const TEST_AMOUNTS = [
    { name: "Tiny (RETAIL)", eth: "0.0003", expectedTier: "RETAIL (3000 bps)" },
    { name: "Small (ELEVATED)", eth: "0.0005", expectedTier: "ELEVATED (6000 bps)" },
    { name: "Medium (ELEVATED)", eth: "0.001", expectedTier: "ELEVATED/TOXIC (6000-15000 bps)" },
];

async function runComparison() {
    console.log("\n🧪 Fee Tier Comparison Tool\n");
    console.log("=".repeat(80));
    console.log("\nThis script will perform multiple swaps with different amounts");
    console.log("to demonstrate the dynamic fee tiers in AminoRiskFeeHook.\n");
    console.log("Test Amounts:");
    TEST_AMOUNTS.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.name}: ${t.eth} ETH → Expected: ${t.expectedTier}`);
    });
    console.log("\n" + "=".repeat(80));

    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const agentWallet = new ethers.Wallet(AGENT_KEY, provider);

    console.log("\nUsing Agent Wallet:", agentWallet.address);
    console.log("Hook Address:", HOOK);
    console.log("\nStarting swaps...\n");

    const results = [];

    for (const test of TEST_AMOUNTS) {
        console.log(`\n${"=".repeat(80)}`);
        console.log(`Testing: ${test.name} (${test.eth} ETH)`);
        console.log(`${"=".repeat(80)}\n`);

        try {
            const result = await executeSwap(provider, agentWallet, test.eth);
            results.push({ ...test, ...result });
            console.log(`✅ Success: Fee Bps = ${result.feeBps}, Rnow = ${result.rnow}\n`);
        } catch (e: any) {
            console.log(`❌ Failed: ${e.message}\n`);
            results.push({ ...test, feeBps: "FAILED", rnow: "N/A", error: e.message });
        }

        // Wait 3 seconds between swaps
        if (TEST_AMOUNTS.indexOf(test) < TEST_AMOUNTS.length - 1) {
            console.log("Waiting 3s before next swap...");
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n📊 COMPARISON RESULTS\n");
    console.log("=".repeat(80));
    console.log("\n| Amount      | Expected Tier          | Actual Fee | Actual Rnow |");
    console.log("|-------------|------------------------|------------|-------------|");
    results.forEach(r => {
        const amt = r.eth.padEnd(11);
        const exp = r.expectedTier.padEnd(22);
        const fee = String(r.feeBps).padEnd(10);
        const rnow = String(r.rnow).padEnd(11);
        console.log(`| ${amt} | ${exp} | ${fee} | ${rnow} |`);
    });
    console.log("\n" + "=".repeat(80));
    console.log("\n✅ Comparison complete!\n");
}

async function executeSwap(provider: any, wallet: any, amountEth: string) {
    const amountInWei = ethers.utils.parseUnits(amountEth, 18).toString();

    // Setup (similar to agentSwap.ts but simplified)
    const mockEthAgent = new ethers.Contract(ETH.address, ERC20_ABI, wallet);
    const isEthToken0 = ETH.address.toLowerCase() < USDC.address.toLowerCase();

    const CurrentConfig = {
        poolKey: {
            currency0: isEthToken0 ? ETH.address : USDC.address,
            currency1: isEthToken0 ? USDC.address : ETH.address,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: HOOK,
        },
        zeroForOne: isEthToken0,
        amountIn: amountInWei,
        amountOutMinimum: "0",
        hookData: "0x",
    };

    // Simplified swap execution (approve + execute)
    const { Actions, V4Planner } = await import("@uniswap/v4-sdk");
    const { CommandType, RoutePlanner } = await import("@uniswap/universal-router-sdk");

    const v4Planner = new V4Planner();
    const routePlanner = new RoutePlanner();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [CurrentConfig]);
    v4Planner.addAction(Actions.SETTLE_ALL, [CurrentConfig.poolKey.currency0, CurrentConfig.amountIn]);
    v4Planner.addAction(Actions.TAKE_ALL, [CurrentConfig.poolKey.currency1, CurrentConfig.amountOutMinimum]);

    const encodedActions = v4Planner.finalize();
    routePlanner.addCommand(CommandType.V4_SWAP, [encodedActions]);

    const ur = new ethers.Contract(UNIVERSAL_ROUTER, UNIVERSAL_ROUTER_ABI, wallet);
    const tx = await ur.execute(routePlanner.commands, routePlanner.inputs, deadline, {
        value: 0,
        gasLimit: 1000000
    });

    const receipt = await tx.wait();

    // Parse SwapRecorded event
    const HOOK_ABI = [
        "event SwapRecorded(bytes32 indexed swapId, bytes32 indexed poolId, address indexed sender, uint256 agentId, uint160 sqrtPriceBeforeX96, uint160 sqrtPriceAfterX96, uint24 feeBps, uint256 Rnow)"
    ];
    const hookInterface = new ethers.utils.Interface(HOOK_ABI);

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === HOOK.toLowerCase()) {
            try {
                const parsed = hookInterface.parseLog(log);
                if (parsed.name === "SwapRecorded") {
                    return {
                        feeBps: parsed.args.feeBps.toString(),
                        rnow: ethers.utils.formatUnits(parsed.args.Rnow, 18),
                        tx: tx.hash
                    };
                }
            } catch (e) { }
        }
    }

    return { feeBps: "NOT_FOUND", rnow: "N/A", tx: tx.hash };
}

runComparison().catch(console.error);
