import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { CommandType, RoutePlanner } from "@uniswap/universal-router-sdk";

const RPC = process.env.SEPOLIA_RPC_URL;
const AGENT_KEY = process.env.AGENT_PRIVATE_KEY || "dac64655d0b78804819c9a29c50038f49eba94619bd348eb3bd4676d2c3b712f";

const UNIVERSAL_ROUTER = "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b";
const STATE_VIEW = "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c";
const HOOK = "0x87722c424B5d9C9b9D6113198b38D668C954C0C0";

const ETH = { address: "0x209a45e3242a2985ba5701e07615b441ff2593c9", decimals: 18 };
const USDC = { address: "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435", decimals: 6 };
const FEE = 5000;
const TICK_SPACING = 60;

export async function POST(request) {
    try {
        const { amount } = await request.json();

        const provider = new ethers.providers.JsonRpcProvider(RPC);
        const wallet = new ethers.Wallet(AGENT_KEY.startsWith("0x") ? AGENT_KEY : `0x${AGENT_KEY}`, provider);
        const amountInWei = ethers.utils.parseUnits(amount, 18);

        // Get pool state
        const isEthToken0 = ETH.address.toLowerCase() < USDC.address.toLowerCase();
        const [token0, token1] = isEthToken0 ? [ETH.address, USDC.address] : [USDC.address, ETH.address];

        const encoded = ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "uint24", "int24", "address"],
            [token0, token1, FEE, TICK_SPACING, HOOK]
        );
        const poolId = ethers.utils.keccak256(encoded);

        const stateViewAbi = [
            "function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity)",
            "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
        ];
        const stateView = new ethers.Contract(STATE_VIEW, stateViewAbi, provider);

        const liquidity = await stateView.getLiquidity(poolId);
        const slot0 = await stateView.getSlot0(poolId);

        // Calculate metrics
        const K = ethers.BigNumber.from("100000000000000000000");
        const priceImpactRaw = amountInWei.mul(ethers.BigNumber.from("1000000000000000000")).div(amountInWei.add(K));
        const priceImpact = parseFloat(ethers.utils.formatUnits(priceImpactRaw, 18));

        const stressRaw = amountInWei.mul(ethers.BigNumber.from("1000000000000000000")).div(liquidity);
        const liquidityStress = parseFloat(ethers.utils.formatUnits(stressRaw, 18));

        const rnowCalculated = 0.6 * priceImpact + 0.4 * liquidityStress;

        let tier, expectedFee;
        if (rnowCalculated < 0.3) {
            tier = "RETAIL";
            expectedFee = 3000;
        } else if (rnowCalculated < 0.7) {
            tier = "ELEVATED";
            expectedFee = 6000;
        } else {
            tier = "TOXIC";
            expectedFee = 15000;
        }

        // Execute swap
        const CurrentConfig = {
            poolKey: {
                currency0: token0,
                currency1: token1,
                fee: FEE,
                tickSpacing: TICK_SPACING,
                hooks: HOOK,
            },
            zeroForOne: isEthToken0,
            amountIn: amountInWei.toString(),
            amountOutMinimum: "0",
            hookData: "0x",
        };

        const v4Planner = new V4Planner();
        const routePlanner = new RoutePlanner();
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [CurrentConfig]);
        v4Planner.addAction(Actions.SETTLE_ALL, [CurrentConfig.poolKey.currency0, CurrentConfig.amountIn]);
        v4Planner.addAction(Actions.TAKE_ALL, [CurrentConfig.poolKey.currency1, CurrentConfig.amountOutMinimum]);

        const encodedActions = v4Planner.finalize();
        routePlanner.addCommand(CommandType.V4_SWAP, [encodedActions]);

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

        const ur = new ethers.Contract(UNIVERSAL_ROUTER, UNIVERSAL_ROUTER_ABI, wallet);
        const tx = await ur.execute(routePlanner.commands, routePlanner.inputs, deadline, {
            value: 0,
            gasLimit: 1000000
        });

        const receipt = await tx.wait();

        // Parse event
        const HOOK_ABI = [
            "event SwapRecorded(bytes32 indexed swapId, bytes32 indexed poolId, address indexed sender, uint256 agentId, uint160 sqrtPriceBeforeX96, uint160 sqrtPriceAfterX96, uint24 feeBps, uint256 Rnow)"
        ];
        const hookInterface = new ethers.utils.Interface(HOOK_ABI);

        let actualFee, actualRnow;
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === HOOK.toLowerCase()) {
                try {
                    const parsed = hookInterface.parseLog(log);
                    if (parsed.name === "SwapRecorded") {
                        actualFee = parsed.args.feeBps.toString();
                        actualRnow = ethers.utils.formatUnits(parsed.args.Rnow, 18);
                    }
                } catch (e) { }
            }
        }

        // Calculate fee economics
        const inputAmount = parseFloat(amount);
        const feeRate = parseFloat(actualFee) / 10000;
        const feeAmount = (inputAmount * feeRate).toFixed(8);
        const netAmount = (inputAmount - parseFloat(feeAmount)).toFixed(8);

        // Tier comparison
        const tiers = [
            { name: "PARTNER", bps: 500 },
            { name: "RETAIL", bps: 3000 },
            { name: "ELEVATED", bps: 6000 },
            { name: "TOXIC", bps: 15000 }
        ];

        const tierComparison = tiers.map(t => ({
            name: t.name,
            bps: t.bps,
            feeAmount: (inputAmount * (t.bps / 10000)).toFixed(8),
            current: t.bps === parseInt(actualFee)
        }));

        return NextResponse.json({
            amount,
            liquidity: liquidity.toString(),
            tick: slot0.tick.toString(),
            priceImpact: priceImpact.toFixed(8),
            liquidityStress: liquidityStress.toFixed(8),
            rnowCalculated: rnowCalculated.toFixed(8),
            rnowActual: actualRnow,
            tier,
            feeExpected: expectedFee,
            feeActual: actualFee,
            feeAmount,
            netAmount,
            tierComparison,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber
        });

    } catch (error) {
        console.error("Demo swap error:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
