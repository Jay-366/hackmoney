"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract, useSendTransaction, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { sortTokens } from "@/lib/sortTokens";
import { parseUnits, formatUnits, isAddress, zeroAddress, maxUint256, encodeAbiParameters, parseAbiParameters, encodePacked, encodeFunctionData } from "viem";
import { getPoolManagerAddress, getUniversalRouterAddress, getPermit2Address } from "@/lib/uniswapV4Addresses";
import { POOL_MANAGER_ABI } from "@/lib/poolManagerAbi";
import { UNIVERSAL_ROUTER_ABI } from "@/lib/universalRouterAbi";
import { PERMIT2_ABI } from "@/lib/permit2Abi";
import { ERC20_ABI } from "@/lib/erc20Abi";
import { getTokenDecimals } from "@/lib/tokenInfo";

const NATIVE_TOKEN_TAG = "NATIVE";

// Universal Router Command
// V4_SWAP = 0x10
const COMMAND_V4_SWAP = "0x10";

export default function SwapPage() {
    return (
        <div className="flex min-h-screen flex-col items-center bg-zinc-50 dark:bg-black font-sans">
            <header className="w-full max-w-5xl flex justify-between items-center py-6 px-8">
                <h1 className="text-3xl font-bold text-black dark:text-zinc-50">Swap</h1>
                <ConnectButton />
            </header>
            <main className="w-full max-w-xl p-4">
                <SwapContent />
            </main>
        </div>
    );
}

function SwapContent() {
    const { address: userAddress, isConnected } = useAccount();
    const chainId = useChainId();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const { sendTransactionAsync } = useSendTransaction();

    // Inputs
    const [tokenIn, setTokenIn] = useState("");
    const [tokenOut, setTokenOut] = useState("");
    const [amountIn, setAmountIn] = useState("");
    const [minAmountOut, setMinAmountOut] = useState("");

    // Pool Key
    const [fee, setFee] = useState("3000");
    const [tickSpacing, setTickSpacing] = useState("60");
    const [hooks, setHooks] = useState("0x0000000000000000000000000000000000000000");

    // Settings
    const [slippageBps, setSlippageBps] = useState("50");
    const [deadlineMinutes, setDeadlineMinutes] = useState("20");

    const [status, setStatus] = useState("");
    const [txHash, setTxHash] = useState("");

    const handleSwap = async () => {
        try {
            setStatus("Preparing swap...");
            setTxHash("");

            if (!userAddress) throw new Error("Wallet not connected");

            const routerAddress = getUniversalRouterAddress(chainId);
            const permit2Address = getPermit2Address(chainId);
            const poolManagerAddress = getPoolManagerAddress(chainId);

            if (!routerAddress || !permit2Address || !poolManagerAddress) {
                throw new Error("Contract addresses not found for this chain");
            }

            // 1. Process Tokens and Amounts
            const isNativeIn = tokenIn === NATIVE_TOKEN_TAG;
            const isNativeOut = tokenOut === NATIVE_TOKEN_TAG;
            const currency0 = isNativeIn ? zeroAddress : tokenIn;
            const currency1 = isNativeOut ? zeroAddress : tokenOut;

            if (!isAddress(currency0) && !isNativeIn) throw new Error("Invalid Token In");
            if (!isAddress(currency1) && !isNativeOut) throw new Error("Invalid Token Out");

            if (!publicClient) throw new Error("Public Client not ready");

            let decimalsIn = 18;
            if (!isNativeIn) {
                decimalsIn = await getTokenDecimals(publicClient, currency0);
            }

            const parsedAmountIn = parseUnits(amountIn, decimalsIn);
            const parsedMinOut = parseUnits(minAmountOut, 18); // Note: Should ideally fetch output decimals

            // 2. Approvals
            if (!isNativeIn) {
                setStatus("Checking Allowance...");
                const allowance = await publicClient.readContract({
                    address: currency0 as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "allowance",
                    args: [userAddress, permit2Address]
                });

                if (allowance < parsedAmountIn) {
                    setStatus("Approving Permit2...");
                    await writeContractAsync({
                        address: currency0 as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [permit2Address, maxUint256]
                    });
                }

                // Permit2 Approval to Universal Router
                setStatus("Checking Permit2 Allowance...");
                // Just approve for simplicity
                await writeContractAsync({
                    address: permit2Address as `0x${string}`,
                    abi: PERMIT2_ABI,
                    functionName: "approve",
                    args: [currency0, routerAddress, maxUint160, maxUint48]
                });
            }

            // 3. Construct Universal Router Commands
            setStatus("Building Transaction...");

            // Dynamic imports to avoid SSR issues if any, though client component should be fine
            const { RoutePlanner, CommandType } = await import("@uniswap/universal-router-sdk");
            const { V4Planner, Actions } = await import("@uniswap/v4-sdk");

            const routePlanner = new RoutePlanner();
            const v4Planner = new V4Planner();

            // A. Input Token Transfer (if ERC20)
            if (!isNativeIn) {
                routePlanner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
                    currency0,
                    routerAddress,
                    parsedAmountIn
                ]);
            }

            // B. V4 Swap Actions
            // Sort tokens for PoolKey
            const sorted = sortTokens(currency0, currency1);
            const zeroForOne = currency0 === sorted[0];
            const poolKey = [
                sorted[0],
                sorted[1],
                parseInt(fee),
                parseInt(tickSpacing),
                hooks
            ];

            // Action 1: Swap
            // params: [poolKey, zeroForOne, amountIn, amountOutMin, hookData]
            v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
                poolKey,
                zeroForOne,
                parsedAmountIn,
                parsedMinOut,
                "0x" // hookData
            ]);

            // Action 2: Settle (Pay Input)
            // If Native In: passed as value to execute.
            // If ERC20 In: already in UR from Permit2.
            // payerIsUser = true (means UR pays PM)
            v4Planner.addAction(Actions.SETTLE, [
                currency0,
                parsedAmountIn,
                true
            ]);

            // Action 3: Take (Receive Output)
            // Take all output to UR (msg.sender)
            // params: [currency, minAmount]
            v4Planner.addAction(Actions.TAKE_ALL, [
                currency1,
                parsedMinOut
            ]);

            const encodedV4Actions = v4Planner.finalize();
            routePlanner.addCommand(CommandType.V4_SWAP, [encodedV4Actions]);

            // C. Sweep Output to User
            // params: [token, recipient, amountMin]
            // If Native Out: Sweep native
            // If ERC20 Out: Sweep ERC20
            const sweepToken = isNativeOut ? zeroAddress : currency1;
            routePlanner.addCommand(CommandType.SWEEP, [
                sweepToken,
                userAddress,
                parsedMinOut
            ]);

            // 4. Execution
            const { commands, inputs } = routePlanner;
            const value = isNativeIn ? parsedAmountIn : BigInt(0);

            setStatus("Simulating Swap...");
            try {
                // Use raw simulation
                await publicClient.call({
                    account: userAddress,
                    to: routerAddress as `0x${string}`,
                    data: encodeFunctionData({
                        abi: UNIVERSAL_ROUTER_ABI,
                        functionName: "execute",
                        args: [commands as `0x${string}`, inputs as `0x${string}`[], BigInt(Math.floor(Date.now() / 1000) + parseInt(deadlineMinutes) * 60)]
                    }),
                    value: value
                });
                console.log("Simulation Passed!");
            } catch (e: any) {
                console.error("Simulation Failed", e);
                // Try decoding error if possible, or just show shortMessage
                setStatus(`Simulation Failed: ${e.shortMessage || e.message}`);
                throw e;
            }

            setStatus("Sending Transaction...");
            const hash = await sendTransactionAsync({
                to: routerAddress as `0x${string}`,
                data: encodeFunctionData({
                    abi: UNIVERSAL_ROUTER_ABI,
                    functionName: "execute",
                    args: [commands as `0x${string}`, inputs as `0x${string}`[], BigInt(Math.floor(Date.now() / 1000) + parseInt(deadlineMinutes) * 60)]
                }),
                value: value
            });

            setTxHash(hash);
            setStatus(`Swap Submitted! Hash: ${hash}`);

        } catch (err: any) {
            console.error(err);
            setStatus(`Error: ${err.message}`);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">

                {/* Token In */}
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Token In</label>
                    <input
                        type="text"
                        placeholder="0x... or NATIVE"
                        value={tokenIn}
                        onChange={(e) => setTokenIn(e.target.value)}
                        className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 border-none outline-none dark:text-white"
                    />
                </div>

                {/* Amount In */}
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Amount In</label>
                    <input
                        type="string"
                        placeholder="0.0"
                        value={amountIn}
                        onChange={(e) => setAmountIn(e.target.value)}
                        className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 border-none outline-none dark:text-white"
                    />
                </div>

                {/* Token Out */}
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Token Out</label>
                    <input
                        type="text"
                        placeholder="0x... or NATIVE"
                        value={tokenOut}
                        onChange={(e) => setTokenOut(e.target.value)}
                        className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 border-none outline-none dark:text-white"
                    />
                </div>

                {/* Min Amount Out */}
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Min Amount Out</label>
                    <input
                        type="string"
                        placeholder="0.0"
                        value={minAmountOut}
                        onChange={(e) => setMinAmountOut(e.target.value)}
                        className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 border-none outline-none dark:text-white"
                    />
                </div>
            </div>

            {/* Pool Key Settings */}
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                <h3 className="font-medium dark:text-zinc-200">Pool Settings</h3>
                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="text"
                        placeholder="Fee (3000)"
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        className="p-2 rounded bg-zinc-100 dark:bg-zinc-800 dark:text-white"
                    />
                    <input
                        type="text"
                        placeholder="Tick Spacing (60)"
                        value={tickSpacing}
                        onChange={(e) => setTickSpacing(e.target.value)}
                        className="p-2 rounded bg-zinc-100 dark:bg-zinc-800 dark:text-white"
                    />
                </div>
                <input
                    type="text"
                    placeholder="Hooks Address"
                    value={hooks}
                    onChange={(e) => setHooks(e.target.value)}
                    className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 dark:text-white"
                />
            </div>

            {/* Status & Action */}
            <div className="space-y-2">
                {status && <div className="p-2 text-sm bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">{status}</div>}

                <button
                    onClick={handleSwap}
                    disabled={!isConnected}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold disabled:opacity-50"
                >
                    Swap
                </button>
            </div>

            {txHash && (
                <div className="p-2 text-sm text-center break-all text-blue-500">
                    Hash: {txHash}
                </div>
            )}
        </div>
    );
}
