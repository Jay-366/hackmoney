"use client";

import { useState, useEffect, Suspense } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract, useSendTransaction } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useSearchParams } from "next/navigation";
import { getPoolRegistryAddress, getPoolManagerAddress, getPositionManagerAddress, getPermit2Address, getStateViewAddress } from "@/lib/uniswapV4Addresses";
import { POOL_REGISTRY_ABI } from "@/lib/poolRegistryAbi";
import { POOL_MANAGER_ABI } from "@/lib/poolManagerAbi";
import { STATE_VIEW_ABI } from "@/lib/stateViewAbi";
import { PERMIT2_ABI } from "@/lib/permit2Abi";
import { ERC20_ABI } from "@/lib/erc20Abi";
import { POSITION_MANAGER_ABI } from "@/lib/positionManagerAbi";
import { sortTokens } from "@/lib/sortTokens";
import { getTokenDecimals } from "@/lib/tokenInfo";
import { MIN_TICK, MAX_TICK, getLiquidityForAmounts, getSqrtRatioAtTick } from "@/lib/liquidityMath";
import { maxUint160, maxUint48, maxUint256, isAddress, zeroAddress, parseUnits, concatHex, toHex, encodeAbiParameters, parseAbiParameters } from "viem";
import { Percent } from "@uniswap/sdk-core";
import { createToken, createPoolFromChain, createPositionFromAmounts, generateMintCalldata } from "@/lib/uniswapV4Sdk";

const NATIVE_TOKEN_TAG = "NATIVE";

// Action Constants (Verified from V4 SDK/Periphery source)
const ACTION_MINT_POSITION = 2; // 0x02
const ACTION_SETTLE_PAIR = 13;   // 0x0D
const ACTION_SWEEP = 20;         // 0x14

function CreatePositionContent() {
    const { address: userAddress, isConnected } = useAccount();
    const chainId = useChainId();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const { sendTransactionAsync } = useSendTransaction();
    const searchParams = useSearchParams();

    // Inputs
    const [tokenA, setTokenA] = useState("");
    const [tokenB, setTokenB] = useState("");
    const [fee, setFee] = useState("3000");
    const [tickSpacing, setTickSpacing] = useState("60");
    const [hooks, setHooks] = useState("0x0000000000000000000000000000000000000000");

    const [amount0, setAmount0] = useState("1");
    const [amount1, setAmount1] = useState("1");

    // New Inputs
    const [tickLower, setTickLower] = useState("");
    const [tickUpper, setTickUpper] = useState("");
    const [fullRange, setFullRange] = useState(false);
    const [slippageBps, setSlippageBps] = useState("50"); // 0.50%
    const [deadlineMinutes, setDeadlineMinutes] = useState("20");

    // UI State
    const [isLocked, setIsLocked] = useState(false);
    const [status, setStatus] = useState("");
    const [poolState, setPoolState] = useState("UNKNOWN");
    const [txStep, setTxStep] = useState(0);

    // Pool Data cache
    const [sqrtPriceX96, setSqrtPriceX96] = useState(0n);
    const [currentTick, setCurrentTick] = useState(0);

    // Contract Addresses
    const registryAddress = getPoolRegistryAddress(chainId);
    const pmAddress = getPoolManagerAddress(chainId);
    const posmAddress = getPositionManagerAddress(chainId);
    const permit2Address = getPermit2Address(chainId);
    const stateViewAddress = getStateViewAddress(chainId);

    // Initial Load
    useEffect(() => {
        const poolIdParam = searchParams.get("poolId");
        if (poolIdParam && registryAddress && publicClient && !isLocked) {
            setStatus("Loading pool info...");
            publicClient.readContract({
                address: registryAddress,
                abi: POOL_REGISTRY_ABI,
                functionName: "getPool",
                args: [poolIdParam]
            }).then((info) => {
                setTokenA(info.currency0 === zeroAddress ? NATIVE_TOKEN_TAG : info.currency0);
                setTokenB(info.currency1 === zeroAddress ? NATIVE_TOKEN_TAG : info.currency1);
                setFee(info.fee.toString());
                setTickSpacing(info.tickSpacing.toString());
                setHooks(info.hooks); // Store hooks
                setIsLocked(true);

                checkSlot0(poolIdParam);
            }).catch(err => {
                console.error(err);
                setStatus("Error loading pool from registry.");
            });
        }
    }, [searchParams, registryAddress, publicClient]);

    // Check Slot0
    const checkSlot0 = async (id) => {
        const targetAddress = stateViewAddress || pmAddress;
        const targetAbi = stateViewAddress ? STATE_VIEW_ABI : POOL_MANAGER_ABI;

        if (!targetAddress) return;

        setPoolState("CHECKING");
        setStatus("Checking initialization...");
        console.log("Checking Slot0 for:", id, "on:", targetAddress);

        try {
            const slot0 = await publicClient.readContract({
                address: targetAddress,
                abi: targetAbi,
                functionName: "getSlot0",
                args: [id]
            });

            // slot0 format: [sqrtPriceX96, tick, protocolFee, lpFee]
            const sqrtP = slot0 ? slot0[0] : 0n;
            const tick = slot0 ? Number(slot0[1]) : 0;

            if (sqrtP > 0n) {
                setPoolState("INITIALIZED");
                setSqrtPriceX96(sqrtP);
                setCurrentTick(tick);
                setStatus("Pool is Initialized. Ready to Mint.");

                // Set default ticks around current if empty
                if (!tickLower && !tickUpper && !fullRange) {
                    const ts = parseInt(tickSpacing);
                    const nearest = Math.floor(tick / ts) * ts;
                    setTickLower((nearest - ts * 2).toString());
                    setTickUpper((nearest + ts * 2).toString());
                }
            } else {
                setPoolState("UNINITIALIZED");
            }
        } catch (err) {
            console.error("Slot0 Check Failed:", err);
            setPoolState("UNINITIALIZED");
            setStatus("");
        }
    };

    // Full Range Toggle
    useEffect(() => {
        if (fullRange) {
            const ts = parseInt(tickSpacing);
            const min = Math.ceil(MIN_TICK / ts) * ts;
            const max = Math.floor(MAX_TICK / ts) * ts;
            setTickLower(min.toString());
            setTickUpper(max.toString());
        }
    }, [fullRange, tickSpacing]);

    // Manual Check
    const handleCheckPool = async () => {
        if (!tokenA || !tokenB) { setStatus("Enter Valid Tokens"); return; }
        if (!registryAddress) return;

        const isNativeA = tokenA === NATIVE_TOKEN_TAG;
        const isNativeB = tokenB === NATIVE_TOKEN_TAG;

        if (!isNativeA && !isAddress(tokenA)) { setStatus("Invalid Token A"); return; }
        if (!isNativeB && !isAddress(tokenB)) { setStatus("Invalid Token B"); return; }

        const [c0, c1] = sortTokens(isNativeA ? zeroAddress : tokenA, isNativeB ? zeroAddress : tokenB);

        const poolKey = {
            currency0: c0,
            currency1: c1,
            fee: parseInt(fee),
            tickSpacing: parseInt(tickSpacing),
            hooks: "0x0000000000000000000000000000000000000000"
        };

        try {
            setStatus("Computing ID...");
            const id = await publicClient.readContract({
                address: registryAddress,
                abi: POOL_REGISTRY_ABI,
                functionName: "computePoolId",
                args: [poolKey]
            });
            await checkSlot0(id);
        } catch (err) {
            console.error(err);
            setStatus("Error computing ID");
        }
    };

    // Add Liquidity Flow
    const handleAddLiquidity = async () => {
        if (!permit2Address || !posmAddress || !userAddress) return;
        setStatus("Starting Liquidity Flow...");

        const isNativeA = tokenA === NATIVE_TOKEN_TAG;
        const isNativeB = tokenB === NATIVE_TOKEN_TAG;
        const [c0, c1] = sortTokens(
            isNativeA ? zeroAddress : tokenA,
            isNativeB ? zeroAddress : tokenB
        );

        let val0 = amount0;
        let val1 = amount1;
        const isTokenA0 = (isNativeA ? zeroAddress : tokenA).toLowerCase() === c0.toLowerCase();
        if (!isTokenA0) {
            val0 = amount1;
            val1 = amount0;
        }

        try {
            // 1. Get Decimals and Parse
            const dec0 = await getTokenDecimals(publicClient, c0, c0 === zeroAddress);
            const dec1 = await getTokenDecimals(publicClient, c1, c1 === zeroAddress);

            const parsed0 = parseUnits(val0, dec0);
            const parsed1 = parseUnits(val1, dec1);

            // Helper for slow networks (Sepolia)
            const wait = (hash) =>
                publicClient.waitForTransactionReceipt({
                    hash,
                    confirmations: 1,
                    pollingInterval: 1_000, // 1s
                    timeout: 180_000,       // 3 min
                });

            // 2. Approve Tokens (Skip Native)
            setTxStep(1);
            if (c0 !== zeroAddress) {
                setStatus(`Approving Token0 (${c0.slice(0, 6)}...)...`);
                const hash0 = await writeContractAsync({ address: c0, abi: ERC20_ABI, functionName: "approve", args: [permit2Address, maxUint256] });
                await wait(hash0);
            }
            if (c1 !== zeroAddress) {
                setStatus(`Approving Token1 (${c1.slice(0, 6)}...)...`);
                const hash1 = await writeContractAsync({ address: c1, abi: ERC20_ABI, functionName: "approve", args: [permit2Address, maxUint256] });
                await wait(hash1);
            }

            // 3. Approve Permit2
            setTxStep(2);
            if (c0 !== zeroAddress) {
                setStatus("Approving Permit2 (Token0)...");
                const hashP0 = await writeContractAsync({ address: permit2Address, abi: PERMIT2_ABI, functionName: "approve", args: [c0, posmAddress, maxUint160, maxUint48] });
                await wait(hashP0);
            }
            if (c1 !== zeroAddress) {
                setStatus("Approving Permit2 (Token1)...");
                const hashP1 = await writeContractAsync({ address: permit2Address, abi: PERMIT2_ABI, functionName: "approve", args: [c1, posmAddress, maxUint160, maxUint48] });
                await wait(hashP1);
            }

            // 4. Build Calldata using SDK
            setTxStep(3);
            setStatus("Building Transaction with SDK...");

            const poolKey = {
                currency0: c0,
                currency1: c1,
                fee: parseInt(fee),
                tickSpacing: parseInt(tickSpacing),
                hooks: hooks
            };

            // Compute poolId for SDK
            const poolId = await publicClient.readContract({
                address: registryAddress,
                abi: POOL_REGISTRY_ABI,
                functionName: "computePoolId",
                args: [poolKey]
            });

            const tLower = parseInt(tickLower);
            const tUpper = parseInt(tickUpper);

            // --- SDK Integration ---
            console.log("Creating SDK Token instances...");
            const decimals0 = await getTokenDecimals(publicClient, c0, c0 === zeroAddress);
            const decimals1 = await getTokenDecimals(publicClient, c1, c1 === zeroAddress);

            const token0 = createToken(chainId, c0, decimals0, `Token0`, `T0`);
            const token1 = createToken(chainId, c1, decimals1, `Token1`, `T1`);

            console.log("Creating SDK Pool instance...");
            const pool = await createPoolFromChain(
                publicClient,
                chainId,
                pmAddress,
                stateViewAddress,
                token0,
                token1,
                parseInt(fee),
                parseInt(tickSpacing),
                hooks,
                poolId
            );

            console.log("Creating SDK Position...");
            const position = createPositionFromAmounts(
                pool,
                tLower,
                tUpper,
                parsed0,
                parsed1,
                true // useFullPrecision
            );

            console.log("SDK Position created:", {
                liquidity: position.liquidity.toString(),
                amount0: position.amount0.toSignificant(6),
                amount1: position.amount1.toSignificant(6)
            });

            // Generate calldata using SDK
            const slippageTolerance = new Percent(slippageBps, 10000);
            const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + parseInt(deadlineMinutes) * 60);

            const { calldata, value } = generateMintCalldata(position, {
                recipient: userAddress,
                slippageTolerance,
                deadline: deadlineTimestamp,
                hookData: "0x"
            });

            console.log("SDK generated calldata length:", calldata.length);
            console.log("SDK value:", value);

            // The SDK returns the full calldata for modifyLiquidities(bytes unlockData, uint256 deadline)
            // We need to decode it to get unlockData and deadline
            // For now, let's use the calldata directly

            // Test B: Log real revert details from simulateContract
            setStatus("Simulating Mint with SDK calldata...");
            console.log("Starting Simulation...");

            try {
                // Use raw call for simulation to bypass viem's encoding logic
                // sdk calldata already includes selector
                await publicClient.call({
                    account: userAddress,
                    to: posmAddress,
                    data: calldata,
                    value: BigInt(value)
                });
                console.log("Simulation Passed!");
                setStatus("Simulation Passed! Check Console.");
            } catch (e) {
                console.error("Simulation Failed!");
                console.log("shortMessage:", e?.shortMessage);
                console.log("message:", e?.message);
                console.log("metaMessages:", e?.metaMessages);
                console.log("cause:", e?.cause);
                setStatus(`Simulation Failed: ${e?.shortMessage || "Check Console"}`);
                throw e; // Stop execution
            }

            setStatus("Sending Mint Transaction...");
            // Use sendTransactionAsync for raw calldata
            const txHash = await sendTransactionAsync({
                to: posmAddress,
                data: calldata,
                value: BigInt(value)
            });

            setStatus(`Mint Submitted! Hash: ${txHash}`);
            setTxStep(0); // Reset

        } catch (err) {
            console.error(err);
            setStatus(`Error: ${err.message}`);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center bg-zinc-50 dark:bg-black font-sans">
            <header className="w-full max-w-5xl flex justify-between items-center py-6 px-8">
                <h1 className="text-3xl font-bold text-black dark:text-zinc-50">Create Position</h1>
                <div className="flex gap-4">
                    <a href="/pools" className="px-4 py-2 text-sm text-zinc-500 hover:text-black dark:text-zinc-400">Back to Pools</a>
                    <ConnectButton />
                </div>
            </header>

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800">
                {/* Inputs */}
                <div className="space-y-4 mb-6">
                    {/* Token A/B */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Token A</label>
                            <input value={tokenA} disabled className={`w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm opacity-70 cursor-not-allowed`} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Token B</label>
                            <input value={tokenB} disabled className={`w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm opacity-70 cursor-not-allowed`} />
                        </div>
                    </div>
                    {/* Fee / Spacing */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Fee</label>
                            <input value={fee} disabled className={`w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm opacity-70 cursor-not-allowed`} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Tick Spac.</label>
                            <input value={tickSpacing} disabled className={`w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm opacity-70 cursor-not-allowed`} />
                        </div>
                    </div>

                    {/* Check Action (Manual Mode) */}
                    {!isLocked && poolState === "UNKNOWN" && (
                        <button onClick={handleCheckPool} disabled={!tokenA || !tokenB || poolState === "CHECKING"} className="w-full py-2 bg-zinc-200 dark:bg-zinc-800 rounded text-sm font-medium">
                            {poolState === "CHECKING" ? "Checking..." : "Check Pool Existence"}
                        </button>
                    )}

                    {/* Uninitialized Error State */}
                    {poolState === "UNINITIALIZED" && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                            <h3 className="text-yellow-800 dark:text-yellow-200 font-bold mb-1">Pool Not Initialized</h3>
                            <a href="/pools/initialize" className="block w-full py-2 bg-yellow-600 text-white text-center rounded text-sm font-bold">Go to Initialize Pool</a>
                        </div>
                    )}

                    {/* Active State */}
                    {poolState === "INITIALIZED" && (
                        <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            {/* Ticks */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-medium text-zinc-500">Tick Range (Mult of {tickSpacing})</label>
                                    <label className="text-xs flex items-center gap-1">
                                        <input type="checkbox" checked={fullRange} onChange={e => setFullRange(e.target.checked)} /> Full Range
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="number" placeholder="Lower" value={tickLower} onChange={e => setTickLower(e.target.value)} disabled={fullRange} className="w-full p-2 bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded text-sm" />
                                    <input type="number" placeholder="Upper" value={tickUpper} onChange={e => setTickUpper(e.target.value)} disabled={fullRange} className="w-full p-2 bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded text-sm" />
                                </div>
                            </div>

                            {/* Amounts */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-zinc-500">Amount 0</label>
                                    <input value={amount0} onChange={e => setAmount0(e.target.value)} className="w-full p-2 bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-zinc-500">Amount 1</label>
                                    <input value={amount1} onChange={e => setAmount1(e.target.value)} className="w-full p-2 bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded text-sm" />
                                </div>
                            </div>

                            {/* Settings */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-zinc-500">Slippage (BPS)</label>
                                    <input type="number" value={slippageBps} onChange={e => setSlippageBps(e.target.value)} className="w-full p-2 bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-zinc-500">Deadline (Min)</label>
                                    <input type="number" value={deadlineMinutes} onChange={e => setDeadlineMinutes(e.target.value)} className="w-full p-2 bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded text-sm" />
                                </div>
                            </div>

                            <button onClick={handleAddLiquidity} disabled={!isConnected || txStep > 0} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded">
                                {txStep > 0 ? "Processing..." : "Approvals & Mint"}
                            </button>
                        </div>
                    )}
                </div>
                {status && <div className="text-center text-sm font-medium text-zinc-600 dark:text-zinc-400 break-all">{status}</div>}
            </div>
        </div>
    );
}

export default function CreatePositionPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CreatePositionContent />
        </Suspense>
    );
}
