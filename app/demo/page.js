"use client";

import { useState } from "react";
import { ethers } from "ethers";

const RPC = "https://eth-sepolia.g.alchemy.com/v2/-KglqcW5EJVPutTa6Z7AK";
const AGENT_KEY = "0xdac64655d0b78804819c9a29c50038f49eba94619bd348eb3bd4676d2c3b712f";

const UNIVERSAL_ROUTER = "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b";
const STATE_VIEW = "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c";
const HOOK = "0x87722c424B5d9C9b9D6113198b38D668C954C0C0";

const ETH = { address: "0x209a45e3242a2985ba5701e07615b441ff2593c9", decimals: 18 };
const USDC = { address: "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435", decimals: 6 };
const FEE = 5000;
const TICK_SPACING = 60;

export default function DemoPage() {
    const [results, setResults] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [currentStep, setCurrentStep] = useState("");

    async function runDemo() {
        setIsRunning(true);
        setResults([]);

        const testAmounts = ["0.0003", "0.0005", "0.001"];
        const demoResults = [];

        for (const amount of testAmounts) {
            setCurrentStep(`Running swap for ${amount} ETH...`);

            try {
                const result = await executeSwap(amount);
                demoResults.push(result);
                setResults([...demoResults]);

                if (amount !== testAmounts[testAmounts.length - 1]) {
                    setCurrentStep("Waiting 3 seconds...");
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } catch (error) {
                console.error("Swap failed:", error);
                demoResults.push({
                    amount,
                    error: error.message,
                });
                setResults([...demoResults]);
            }
        }

        setCurrentStep("Demo complete!");
        setIsRunning(false);
    }

    async function executeSwap(amountEth) {
        const { Actions, V4Planner } = await import("@uniswap/v4-sdk");
        const { CommandType, RoutePlanner } = await import("@uniswap/universal-router-sdk");

        const provider = new ethers.providers.JsonRpcProvider(RPC);
        const wallet = new ethers.Wallet(AGENT_KEY, provider);
        const amountInWei = ethers.utils.parseUnits(amountEth, 18);

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
        const inputAmount = parseFloat(amountEth);
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

        return {
            amount: amountEth,
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
        };
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        AminoRiskFeeHook Demo
                    </h1>
                    <p className="text-xl text-gray-300">
                        Dynamic Fee Tiers Based on Swap Risk Metrics
                    </p>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <InfoCard
                        title="Price Impact (I)"
                        formula="I = amt / (amt + K)"
                        weight="60%"
                        description="Measures how much the swap moves the price"
                    />
                    <InfoCard
                        title="Liquidity Stress (S)"
                        formula="S = amt / poolLiquidity"
                        weight="40%"
                        description="Measures swap size vs available liquidity"
                    />
                    <InfoCard
                        title="Combined Risk (Rnow)"
                        formula="Rnow = 0.6×I + 0.4×S"
                        weight="100%"
                        description="Weighted combination determines fee tier"
                    />
                </div>

                {/* Fee Tiers Legend */}
                <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 mb-8 border border-slate-700">
                    <h2 className="text-2xl font-bold mb-4">Fee Tier Thresholds</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <TierBadge tier="PARTNER" range="Rnow < 0.1" fee="0.05%" color="green" note="Bonded only" />
                        <TierBadge tier="RETAIL" range="Rnow < 0.3" fee="0.30%" color="blue" />
                        <TierBadge tier="ELEVATED" range="0.3 ≤ Rnow < 0.7" fee="0.60%" color="yellow" />
                        <TierBadge tier="TOXIC" range="Rnow ≥ 0.7" fee="1.50%" color="red" />
                    </div>
                </div>

                {/* Run Button */}
                <div className="text-center mb-8">
                    <button
                        onClick={runDemo}
                        disabled={isRunning}
                        className={`px-8 py-4 rounded-lg text-lg font-semibold transition-all ${isRunning
                                ? "bg-gray-600 cursor-not-allowed"
                                : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl"
                            }`}
                    >
                        {isRunning ? "Running Demo..." : "🚀 Run Demo"}
                    </button>
                    {currentStep && (
                        <p className="mt-4 text-gray-300">{currentStep}</p>
                    )}
                </div>

                {/* Results */}
                {results.length > 0 && (
                    <div className="space-y-6">
                        {results.map((result, idx) => (
                            <SwapResultCard key={idx} result={result} index={idx} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function InfoCard({ title, formula, weight, description }) {
    return (
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <code className="text-sm text-blue-300 block mb-2">{formula}</code>
            <div className="text-yellow-400 text-sm mb-2">Weight: {weight}</div>
            <p className="text-gray-400 text-sm">{description}</p>
        </div>
    );
}

function TierBadge({ tier, range, fee, color, note }) {
    const colors = {
        green: "from-green-500 to-emerald-600",
        blue: "from-blue-500 to-cyan-600",
        yellow: "from-yellow-500 to-orange-600",
        red: "from-red-500 to-pink-600",
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color]} rounded-lg p-4 text-center`}>
            <div className="font-bold text-lg">{tier}</div>
            <div className="text-sm opacity-90 my-1">{range}</div>
            <div className="text-xl font-bold">{fee}</div>
            {note && <div className="text-xs mt-1 opacity-75">{note}</div>}
        </div>
    );
}

function SwapResultCard({ result, index }) {
    if (result.error) {
        return (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-6">
                <h3 className="text-xl font-bold text-red-400 mb-2">
                    Swap #{index + 1}: {result.amount} ETH
                </h3>
                <p className="text-red-300">Error: {result.error}</p>
            </div>
        );
    }

    const tierGradients = {
        PARTNER: "from-green-500 to-emerald-600",
        RETAIL: "from-blue-500 to-cyan-600",
        ELEVATED: "from-yellow-500 to-orange-600",
        TOXIC: "from-red-500 to-pink-600",
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">
                    Swap #{index + 1}: {result.amount} ETH
                </h3>
                <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${tierGradients[result.tier]} font-bold`}>
                    {result.tier} - {result.feeActual} bps
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Calculations */}
                <div className="space-y-4">
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <h4 className="font-semibold mb-2 text-blue-400">📊 Pool State</h4>
                        <div className="text-sm space-y-1 text-gray-300">
                            <div>Liquidity: {result.liquidity}</div>
                            <div>Tick: {result.tick}</div>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <h4 className="font-semibold mb-2 text-purple-400">🧮 Risk Metrics</h4>
                        <div className="text-sm space-y-2">
                            <div>
                                <span className="text-gray-400">Price Impact:</span>
                                <span className="ml-2 font-mono text-blue-300">{result.priceImpact}</span>
                            </div>
                            <div>
                                <span className="text-gray-400">Liquidity Stress:</span>
                                <span className="ml-2 font-mono text-purple-300">{result.liquidityStress}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-700">
                                <span className="text-gray-400">Rnow (Combined):</span>
                                <span className="ml-2 font-mono text-yellow-300 font-bold text-lg">
                                    {parseFloat(result.rnowActual).toFixed(6)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Fee Breakdown */}
                <div className="space-y-4">
                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <h4 className="font-semibold mb-2 text-green-400">💰 Fee Economics</h4>
                        <div className="text-sm space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Input:</span>
                                <span className="font-mono">{result.amount} ETH</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Fee Rate:</span>
                                <span className="font-mono">{result.feeActual} bps ({(result.feeActual / 10000).toFixed(2)}%)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Fee Amount:</span>
                                <span className="font-mono text-red-300">{result.feeAmount} ETH</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-700">
                                <span className="text-gray-400">Net for Swap:</span>
                                <span className="font-mono text-green-300 font-bold">{result.netAmount} ETH</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 rounded-lg p-4">
                        <h4 className="font-semibold mb-2 text-yellow-400">📊 Fee Comparison</h4>
                        <div className="text-xs space-y-1">
                            {result.tierComparison.map((tier, i) => (
                                <div
                                    key={i}
                                    className={`flex justify-between p-2 rounded ${tier.current ? "bg-yellow-900/30 border border-yellow-600" : ""
                                        }`}
                                >
                                    <span className={tier.current ? "font-bold" : "text-gray-400"}>
                                        {tier.name} {tier.current && "← YOU"}
                                    </span>
                                    <span className="font-mono">{tier.feeAmount} ETH</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction Link */}
            {result.txHash && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                    <a
                        href={`https://sepolia.etherscan.io/tx/${result.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                        🔗 View on Etherscan: {result.txHash.slice(0, 10)}...{result.txHash.slice(-8)}
                    </a>
                </div>
            )}
        </div>
    );
}
