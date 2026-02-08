// app/swap/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
    useAccount,
    useChainId,
    usePublicClient,
    useSendTransaction,
    useWriteContract,
} from "wagmi";

import {
    isAddress,
    zeroAddress,
    parseUnits,
    formatUnits,
    encodeAbiParameters,
    keccak256,
    encodeFunctionData,
    maxUint256,
} from "viem";

import { UNIVERSAL_ROUTER_ABI } from "@/lib/universalRouterAbi";
import { PERMIT2_ABI } from "@/lib/permit2Abi";
import { ERC20_ABI } from "@/lib/erc20Abi";
import { POOL_MANAGER_ABI } from "@/lib/poolManagerAbi";
import { getTokenDecimals } from "@/lib/tokenInfo";
import {
    getUniversalRouterAddress,
    getPermit2Address,
    getPoolManagerAddress,
} from "@/lib/uniswapV4Addresses";
import { sortTokens } from "@/lib/sortTokens";

// ====== Fixed pool config (your pool) ======
const ETH = { address: "0x209a45e3242a2985ba5701e07615b441ff2593c9", decimals: 18 };
const USDC = { address: "0xaf6c3a632806ed83155f9f582d1c63ac31d1d435", decimals: 6 };
const HOOK = "0x8E5AA11AD9165E247a2c8C12d3a3f873BA4340c0";
const FEE = 3000;
const TICK_SPACING = 6;

const NATIVE = "NATIVE";

// Permit2 approve limits
const MAX_UINT160 = (1n << 160n) - 1n;
const MAX_UINT48 = (1n << 48n) - 1n;

function computePoolId(
    currency0: `0x${string}`,
    currency1: `0x${string}`,
    fee: number,
    tickSpacing: number,
    hooks: `0x${string}`
) {
    // Note: this matches your PoolRegistry.computePoolId style (abi.encode + keccak256)
    const encoded = encodeAbiParameters(
        [
            { name: "currency0", type: "address" },
            { name: "currency1", type: "address" },
            { name: "fee", type: "uint24" },
            { name: "tickSpacing", type: "int24" },
            { name: "hooks", type: "address" },
        ],
        [currency0, currency1, fee, tickSpacing, hooks]
    );
    return keccak256(encoded);
}

function sqrtPriceX96ToPrice1Per0_1e18(sqrtPriceX96: bigint): bigint {
    // price = (sqrtP^2 / 2^192)
    const numerator = sqrtPriceX96 * sqrtPriceX96;
    const Q192 = 1n << 192n;
    return (numerator * 10n ** 18n) / Q192;
}

export default function SwapPage() {
    return (
        <div className="flex min-h-screen flex-col items-center bg-zinc-50 dark:bg-black font-sans">
            <header className="w-full max-w-5xl flex justify-between items-center py-6 px-8">
                <h1 className="text-3xl font-bold text-black dark:text-zinc-50">
                    V4 Swap (Hooked Pool)
                </h1>
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
    const { sendTransactionAsync } = useSendTransaction();
    const { writeContractAsync } = useWriteContract();

    // ====== Defaults: fixed ETH/USDC pool you provided ======
    const [tokenIn, setTokenIn] = useState<string>(ETH.address);
    const [tokenOut, setTokenOut] = useState<string>(USDC.address);
    const [fee, setFee] = useState<string>(String(FEE));
    const [tickSpacing, setTickSpacing] = useState<string>(String(TICK_SPACING));

    // Amounts
    const [amountIn, setAmountIn] = useState<string>("0.01");

    // settings
    const [slippageBps, setSlippageBps] = useState<string>("50"); // 0.50%
    const [deadlineMinutes, setDeadlineMinutes] = useState<string>("20");

    // derived decimals
    const [decimalsIn, setDecimalsIn] = useState<number>(ETH.decimals);
    const [decimalsOut, setDecimalsOut] = useState<number>(USDC.decimals);

    // quotes
    const [quotedOut, setQuotedOut] = useState<bigint | null>(null);
    const [minOut, setMinOut] = useState<bigint | null>(null);

    // ui
    const [status, setStatus] = useState<string>("");
    const [txHash, setTxHash] = useState<string>("");

    const router = useMemo(() => getUniversalRouterAddress(chainId), [chainId]);
    const permit2 = useMemo(() => getPermit2Address(chainId), [chainId]);
    const poolManager = useMemo(() => getPoolManagerAddress(chainId), [chainId]);

    const isNativeIn = tokenIn.trim().toUpperCase() === NATIVE;
    const isNativeOut = tokenOut.trim().toUpperCase() === NATIVE;

    const currencyIn = (isNativeIn ? zeroAddress : tokenIn.trim()) as `0x${string}`;
    const currencyOut = (isNativeOut ? zeroAddress : tokenOut.trim()) as `0x${string}`;

    const canQuote = useMemo(() => {
        if (!publicClient || !poolManager) return false;
        if (!amountIn) return false;
        if (!isNativeIn && !isAddress(currencyIn)) return false;
        if (!isNativeOut && !isAddress(currencyOut)) return false;
        if (currencyIn.toLowerCase() === currencyOut.toLowerCase()) return false;
        if (!fee || !tickSpacing) return false;
        return true;
    }, [
        publicClient,
        poolManager,
        amountIn,
        isNativeIn,
        isNativeOut,
        currencyIn,
        currencyOut,
        fee,
        tickSpacing,
    ]);

    // fetch decimals (kept for safety if user changes token addresses)
    useEffect(() => {
        (async () => {
            if (!publicClient) return;
            try {
                if (isNativeIn) setDecimalsIn(18);
                else if (isAddress(currencyIn)) {
                    try {
                        setDecimalsIn(await getTokenDecimals(publicClient, currencyIn, false));
                    } catch { setDecimalsIn(18); }
                }

                if (isNativeOut) setDecimalsOut(18);
                else if (isAddress(currencyOut)) {
                    try {
                        setDecimalsOut(await getTokenDecimals(publicClient, currencyOut, false));
                    } catch { setDecimalsOut(18); }
                }
            } catch {
                // ignore
            }
        })();
    }, [publicClient, isNativeIn, isNativeOut, currencyIn, currencyOut]);

    // auto quote (spot) using slot0 sqrtPriceX96
    useEffect(() => {
        let alive = true;

        (async () => {
            if (!canQuote) {
                setQuotedOut(null);
                setMinOut(null);
                return;
            }

            try {
                const feeU24 = Number(fee);
                const tick = Number(tickSpacing);
                if (!Number.isFinite(feeU24) || !Number.isFinite(tick)) return;

                const sorted = sortTokens(currencyIn, currencyOut);
                const zeroForOne = currencyIn.toLowerCase() === sorted[0].toLowerCase();

                const poolId = computePoolId(
                    sorted[0] as `0x${string}`,
                    sorted[1] as `0x${string}`,
                    feeU24,
                    tick,
                    HOOK as `0x${string}`
                );

                // getSlot0(poolId)
                const slot0: any = await publicClient!.readContract({
                    address: poolManager as `0x${string}`,
                    abi: POOL_MANAGER_ABI,
                    functionName: "getSlot0",
                    args: [poolId],
                });

                const sqrtPriceX96 = slot0[0] as bigint;
                if (sqrtPriceX96 === 0n) {
                    if (!alive) return;
                    setQuotedOut(null);
                    setMinOut(null);
                    return;
                }

                const price1Per0_1e18 = sqrtPriceX96ToPrice1Per0_1e18(sqrtPriceX96);

                const amtIn = parseUnits(amountIn, decimalsIn);

                // token0->token1: out = in*price; token1->token0: out=in/price
                let outRaw: bigint;
                if (zeroForOne) {
                    outRaw = (amtIn * price1Per0_1e18) / 10n ** 18n;
                } else {
                    outRaw =
                        (amtIn * 10n ** 18n) /
                        (price1Per0_1e18 === 0n ? 1n : price1Per0_1e18);
                }

                // Approx fee deduction (NOTE: fee=3000 is NOT bps; this is only a rough UI estimate)
                // Keeping your existing behavior but this is just "spot estimate".
                const feeBpsApprox = BigInt(feeU24); // rough
                const effectiveOut = (outRaw * (10_000n - feeBpsApprox)) / 10_000n;

                const slip = BigInt(slippageBps || "0");
                const minOutRaw = (effectiveOut * (10_000n - slip)) / 10_000n;

                if (!alive) return;
                setQuotedOut(effectiveOut);
                setMinOut(minOutRaw);
            } catch {
                if (!alive) return;
                setQuotedOut(null);
                setMinOut(null);
            }
        })();

        return () => {
            alive = false;
        };
    }, [
        canQuote,
        amountIn,
        decimalsIn,
        fee,
        tickSpacing,
        slippageBps,
        currencyIn,
        currencyOut,
        poolManager,
        publicClient,
    ]);

    async function handleSwap() {
        try {
            setStatus("");
            setTxHash("");

            if (!isConnected || !userAddress) throw new Error("Connect wallet first");
            if (!router || !permit2 || !poolManager) throw new Error("Missing chain contract addresses");
            if (!amountIn) throw new Error("Enter amount in");

            if (!isNativeIn && !isAddress(currencyIn)) throw new Error("Invalid tokenIn");
            if (!isNativeOut && !isAddress(currencyOut)) throw new Error("Invalid tokenOut");

            const feeU24 = Number(fee);
            const tick = Number(tickSpacing);
            if (!Number.isFinite(feeU24) || !Number.isFinite(tick)) throw new Error("Bad pool params");

            const sorted = sortTokens(currencyIn, currencyOut);
            const zeroForOne = currencyIn.toLowerCase() === sorted[0].toLowerCase();

            const amtIn = parseUnits(amountIn, decimalsIn);
            const amtOutMin = minOut ?? 0n;

            // ERC20 approvals if needed
            if (!isNativeIn) {
                setStatus("Checking ERC20 allowance...");
                const allowance = (await publicClient!.readContract({
                    address: currencyIn,
                    abi: ERC20_ABI,
                    functionName: "allowance",
                    args: [userAddress, permit2 as `0x${string}`],
                })) as bigint;

                if (allowance < amtIn) {
                    setStatus("Approving Permit2 on token...");
                    await writeContractAsync({
                        address: currencyIn,
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [permit2 as `0x${string}`, maxUint256],
                    });
                }

                setStatus("Approving Universal Router on Permit2...");
                await writeContractAsync({
                    address: permit2 as `0x${string}`,
                    abi: PERMIT2_ABI,
                    functionName: "approve",
                    args: [
                        currencyIn as `0x${string}`,
                        router as `0x${string}`,
                        MAX_UINT160,
                        Number(MAX_UINT48),
                    ],
                });
            }

            setStatus("Building v4 swap call...");

            const { RoutePlanner, CommandType } = await import("@uniswap/universal-router-sdk");
            const { V4Planner, Actions } = await import("@uniswap/v4-sdk");

            const routePlanner = new RoutePlanner();
            const v4Planner = new V4Planner();

            // Hooked pool config
            const swapConfig = {
                poolKey: {
                    currency0: sorted[0],
                    currency1: sorted[1],
                    fee: feeU24,
                    tickSpacing: tick,
                    hooks: HOOK as `0x${string}`,
                },
                zeroForOne,
                amountIn: amtIn.toString(),
                amountOutMinimum: amtOutMin.toString(),
                // If your hook requires structured data, change this.
                hookData: "0x",
            };

            // Plan v4 actions
            v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);
            v4Planner.addAction(Actions.SETTLE_ALL, [swapConfig.poolKey.currency0, swapConfig.amountIn]);
            v4Planner.addAction(Actions.TAKE_ALL, [swapConfig.poolKey.currency1, swapConfig.amountOutMinimum]);

            const encodedActions = v4Planner.finalize();

            // Route command
            routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);

            const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(deadlineMinutes) * 60);

            const data = encodeFunctionData({
                abi: UNIVERSAL_ROUTER_ABI,
                functionName: "execute",
                args: [
                    routePlanner.commands as `0x${string}`,
                    [encodedActions] as `0x${string}`[],
                    deadline,
                ],
            });

            setStatus("Simulating...");
            await publicClient!.call({
                account: userAddress,
                to: router as `0x${string}`,
                data,
                value: isNativeIn ? amtIn : 0n,
            });

            setStatus("Sending tx...");
            const hash = await sendTransactionAsync({
                to: router as `0x${string}`,
                data,
                value: isNativeIn ? amtIn : 0n,
            });

            setTxHash(hash);
            setStatus("Submitted ✅");
        } catch (e: any) {
            setStatus(`Error: ${e?.shortMessage ?? e?.message ?? String(e)}`);
        }
    }

    const quotedOutText = useMemo(() => {
        if (quotedOut == null) return "-";
        return formatUnits(quotedOut, decimalsOut);
    }, [quotedOut, decimalsOut]);

    const minOutText = useMemo(() => {
        if (minOut == null) return "-";
        return formatUnits(minOut, decimalsOut);
    }, [minOut, decimalsOut]);

    return (
        <div className="flex flex-col gap-4">
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                <div className="text-xs text-zinc-500 font-mono">
                    <div>Hook: {HOOK}</div>
                    <div>Fee: {fee} | TickSpacing: {tickSpacing}</div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Token In</label>
                    <input
                        type="text"
                        placeholder='0x... or "NATIVE"'
                        value={tokenIn}
                        onChange={(e) => setTokenIn(e.target.value)}
                        className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 border-none outline-none dark:text-white"
                    />
                    <div className="text-xs mt-1 text-zinc-500">Use NATIVE for ETH.</div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Token Out</label>
                    <input
                        type="text"
                        placeholder='0x... or "NATIVE"'
                        value={tokenOut}
                        onChange={(e) => setTokenOut(e.target.value)}
                        className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 border-none outline-none dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Amount In</label>
                    <input
                        type="text"
                        placeholder="0.0"
                        value={amountIn}
                        onChange={(e) => setAmountIn(e.target.value)}
                        className="w-full p-2 rounded bg-zinc-100 dark:bg-zinc-800 border-none outline-none dark:text-white"
                    />
                </div>

                <div className="p-3 rounded bg-zinc-50 dark:bg-zinc-800">
                    <div className="text-sm dark:text-zinc-200">
                        Estimated Out (spot): <b>{quotedOutText}</b>
                    </div>
                    <div className="text-sm dark:text-zinc-200">
                        Min Out (slippage): <b>{minOutText}</b>
                    </div>
                    <div className="text-xs mt-1 text-zinc-500">
                        Quote uses current pool spot price (no price-impact simulation).
                    </div>
                </div>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                <h3 className="font-medium dark:text-zinc-200">Pool Settings (Hooked)</h3>

                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="text"
                        placeholder="Fee (e.g. 3000)"
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        className="p-2 rounded bg-zinc-100 dark:bg-zinc-800 dark:text-white"
                    />
                    <input
                        type="text"
                        placeholder="Tick Spacing (e.g. 6)"
                        value={tickSpacing}
                        onChange={(e) => setTickSpacing(e.target.value)}
                        className="p-2 rounded bg-zinc-100 dark:bg-zinc-800 dark:text-white"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="text"
                        placeholder="Slippage (bps)"
                        value={slippageBps}
                        onChange={(e) => setSlippageBps(e.target.value)}
                        className="p-2 rounded bg-zinc-100 dark:bg-zinc-800 dark:text-white"
                    />
                    <input
                        type="text"
                        placeholder="Deadline (minutes)"
                        value={deadlineMinutes}
                        onChange={(e) => setDeadlineMinutes(e.target.value)}
                        className="p-2 rounded bg-zinc-100 dark:bg-zinc-800 dark:text-white"
                    />
                </div>

                <div className="text-xs text-zinc-500">
                    Hooks are fixed to <span className="font-mono">{HOOK}</span> in this page (edit hookData if your hook requires it).
                </div>
            </div>

            {status && (
                <div className="p-2 text-sm bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
                    {status}
                </div>
            )}

            <button
                onClick={handleSwap}
                disabled={!isConnected}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold disabled:opacity-50"
            >
                Swap
            </button>

            {txHash && (
                <div className="p-2 text-sm text-center break-all text-blue-500">
                    Hash: {txHash}
                </div>
            )}
        </div>
    );
}
