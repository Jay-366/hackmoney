import { ethers } from "ethers";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { CommandType, RoutePlanner } from "@uniswap/universal-router-sdk";
import { encodeHookData } from "../lib/hookData";

const RPC = process.env.SEPOLIA_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const UNIVERSAL_ROUTER = "0x66a9893cc07d91d95644aedd05d03f95e1dba8af";
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

// ====== Fill these with YOUR pool params ======
const ETH = { address: "0x6f8020Bd22913F46fe60d6A3330A4B4E7fB13aEB", decimals: 18 };
const USDC = { address: "0x6F89Cd685215188050e05d57456c16d0c9EdD354", decimals: 6 };
const HOOK = "0x4545454545454545454545454545454545454545";
const FEE = 500;
const TICK_SPACING = 60;

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet("dac64655d0b78804819c9a29c50038f49eba94619bd348eb3bd4676d2c3b712f", provider);

    const amountInWei = ethers.utils.parseUnits("0.01", 18).toString(); // 0.01 ETH
    const hookData = encodeHookData({ agentId: 945n, proof: "0x" });

    const CurrentConfig = {
        poolKey: {
            currency0: ETH.address,
            currency1: USDC.address,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: HOOK,
        },
        zeroForOne: true,
        amountIn: amountInWei,
        amountOutMinimum: "0",
        hookData,
    };

    const v4Planner = new V4Planner();
    const routePlanner = new RoutePlanner();

    const deadline = Math.floor(Date.now() / 1000) + 3600;

    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [CurrentConfig]);
    v4Planner.addAction(Actions.SETTLE_ALL, [CurrentConfig.poolKey.currency0, CurrentConfig.amountIn]);
    v4Planner.addAction(Actions.TAKE_ALL, [CurrentConfig.poolKey.currency1, CurrentConfig.amountOutMinimum]);

    const encodedActions = v4Planner.finalize();
    routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);

    const ur = new ethers.Contract(UNIVERSAL_ROUTER, UNIVERSAL_ROUTER_ABI, wallet);

    const tx = await ur.execute(routePlanner.commands, [encodedActions], deadline, {
        value: amountInWei, // native ETH in
    });

    console.log("tx:", tx.hash);
    const receipt = await tx.wait();
    console.log("confirmed:", receipt.hash);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
