
import { ethers } from "ethers";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { CommandType, RoutePlanner } from "@uniswap/universal-router-sdk";
import { encodeHookData } from "../lib/hookData";
import { config } from "dotenv";

config({ path: ".env.local" });

const RPC = process.env.SEPOLIA_RPC_URL!;

// Key 1: Deployer (holds initial MockETH)
let DEPLOYER_KEY = process.env.PRIVATE_KEY!;
if (!DEPLOYER_KEY.startsWith("0x")) DEPLOYER_KEY = `0x${DEPLOYER_KEY}`;

// Key 2: Agent (User Provided Test Key)
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
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function mint(address to, uint256 amount) external" // Only applies to MockUSDC
];

const ETH = { address: "0x209a45e3242a2985ba5701e07615b441ff2593c9", decimals: 18 }; // MockETH
const USDC = { address: "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435", decimals: 6 }; // MockUSDC
const HOOK = "0x87722c424B5d9C9b9D6113198b38D668C954C0C0";
const FEE = 5000; // 0.5%
const TICK_SPACING = 60;

async function main() {
    console.log("Using RPC:", RPC);
    const provider = new ethers.providers.JsonRpcProvider(RPC);

    const deployerWallet = new ethers.Wallet(DEPLOYER_KEY, provider);
    const agentWallet = new ethers.Wallet(AGENT_KEY, provider);

    console.log("Deployer:", deployerWallet.address);
    console.log("Agent:", agentWallet.address);

    const amountInWei = ethers.utils.parseUnits("0.1", 18).toString(); // 0.1 ETH - reasonable test amount

    // --- Fund Agent with MockETH (from Deployer) ---
    const mockEthDeployer = new ethers.Contract(ETH.address, ERC20_ABI, deployerWallet);
    const mockEthAgent = new ethers.Contract(ETH.address, ERC20_ABI, agentWallet);

    // Check Agent MockETH Balance
    const agentBal = await mockEthAgent.balanceOf(agentWallet.address);
    console.log("Agent MockETH Balance:", ethers.utils.formatUnits(agentBal, 18));

    if (agentBal.lt(amountInWei)) {
        console.log("Funding Agent with MockETH from Deployer...");
        const fundingTx = await mockEthDeployer.transfer(agentWallet.address, ethers.utils.parseEther("1")); // Send 1 MockETH
        console.log("Funding TX sent:", fundingTx.hash);
        await fundingTx.wait();
        console.log("Funded.");
    }

    // --- Fund Agent with MockUSDC (Mint) ---
    const mockUsdc = new ethers.Contract(USDC.address, ERC20_ABI, agentWallet);
    const usdcBalBefore = await mockUsdc.balanceOf(agentWallet.address);
    console.log("USDC Balance Before:", ethers.utils.formatUnits(usdcBalBefore, 6));
    // Not strictly needed for swap if swapping ETH -> USDC, but good to have gas tokens or if input is USDC.
    // Here we swap MockETH -> MockUSDC.

    // --- Proceed to Swap ---
    console.log("Setting up Retail Swap (Invalid Agent)...");

    // Use Empty Hook Data to avoid Agent-Logic related reverts for now
    const hookData = encodeHookData({ agentId: 123456n, proof: "0x" });
    // const hookData = "0x";

    // Determine config
    const isEthToken0 = ETH.address.toLowerCase() < USDC.address.toLowerCase();

    const CurrentConfig = {
        poolKey: {
            currency0: isEthToken0 ? ETH.address : USDC.address,
            currency1: isEthToken0 ? USDC.address : ETH.address,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: HOOK,
        },
        zeroForOne: isEthToken0, // Swapping ETH (token0) -> USDC (token1)
        amountIn: amountInWei.toString(),
        amountOutMinimum: "0",
        hookData,
    };

    console.log("Swap Config:", CurrentConfig);

    const v4Planner = new V4Planner();
    const routePlanner = new RoutePlanner();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [CurrentConfig]);
    v4Planner.addAction(Actions.SETTLE_ALL, [CurrentConfig.poolKey.currency0, CurrentConfig.amountIn]);
    v4Planner.addAction(Actions.TAKE_ALL, [CurrentConfig.poolKey.currency1, CurrentConfig.amountOutMinimum]);

    const encodedActions = v4Planner.finalize();
    routePlanner.addCommand(CommandType.V4_SWAP, [encodedActions]);

    // Approve Permit2
    console.log("Approving Permit2...");
    const approveTx = await mockEthAgent.approve(PERMIT2, ethers.constants.MaxUint256);
    await approveTx.wait();

    // Approve Router on Permit2
    const permit2Contract = new ethers.Contract(PERMIT2, [
        "function approve(address token, address spender, uint160 amount, uint48 expiration) external"
    ], agentWallet);

    console.log("Approving Router on Permit2...");
    // Use MaxUint160 prevent overflow
    const maxUint160 = ethers.BigNumber.from("1461501637330902918203684832716283019655932542975");
    const p2Tx = await permit2Contract.approve(ETH.address, UNIVERSAL_ROUTER, maxUint160, 2000000000000);
    await p2Tx.wait();

    const ur = new ethers.Contract(UNIVERSAL_ROUTER, UNIVERSAL_ROUTER_ABI, agentWallet);

    console.log("Executing Swap...");
    const tx = await ur.execute(routePlanner.commands, routePlanner.inputs, deadline, {
        value: 0, // MockETH is ERC20
        gasLimit: 5000000
    });

    console.log("tx:", tx.hash);
    const receipt = await tx.wait();
    console.log("Confirmed! Transaction Hash:", tx.hash);
    console.log("Block Number:", receipt.blockNumber);
    console.log("⛽ Gas Used (Retail):", receipt.gasUsed.toString());

    // Check USDC Balance After
    const usdcBalAfter = await mockUsdc.balanceOf(agentWallet.address);
    const received = usdcBalAfter.sub(usdcBalBefore);
    console.log("💰 USDC Received (Retail):", ethers.utils.formatUnits(received, 6));
    console.log("   (Input: 0.1 ETH)");

    // Parse logs for SwapRecorded
    const HOOK_ABI = [
        "event SwapRecorded(bytes32 indexed swapId, bytes32 indexed poolId, address indexed sender, uint256 agentId, uint160 sqrtPriceBeforeX96, uint160 sqrtPriceAfterX96, uint24 feeBps, uint256 Rnow)"
    ];
    const hookInterface = new ethers.utils.Interface(HOOK_ABI);

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === HOOK.toLowerCase()) {
            try {
                const parsed = hookInterface.parseLog(log);
                if (parsed.name === "SwapRecorded") {
                    console.log("✅ SwapRecorded Event Found!");
                    console.log("   Fee Bps:", parsed.args.feeBps.toString());
                    console.log("   Rnow:", ethers.utils.formatUnits(parsed.args.Rnow, 18));
                }
            } catch (e) { }
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
