"use client";

import { useState, useEffect, Suspense } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useSearchParams } from "next/navigation";
import { getPoolRegistryAddress, getPoolManagerAddress, getPositionManagerAddress, getPermit2Address } from "@/lib/uniswapV4Addresses";
import { POOL_REGISTRY_ABI } from "@/lib/poolRegistryAbi";
import { POOL_MANAGER_ABI } from "@/lib/poolManagerAbi";
import { PERMIT2_ABI } from "@/lib/permit2Abi";
import { ERC20_ABI } from "@/lib/erc20Abi";
import { sortTokens } from "@/lib/sortTokens";
import { maxUint160, maxUint48, maxUint256, isAddress, zeroAddress } from "viem";

const NATIVE_TOKEN_TAG = "NATIVE";

function CreatePositionContent() {
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const searchParams = useSearchParams();

    // Inputs
    const [tokenA, setTokenA] = useState("");
    const [tokenB, setTokenB] = useState("");
    const [fee, setFee] = useState("3000");
    const [tickSpacing, setTickSpacing] = useState("60");
    const [amount0, setAmount0] = useState("10"); // Deposit Amount
    const [amount1, setAmount1] = useState("10"); // Deposit Amount

    // UI State
    const [isLocked, setIsLocked] = useState(false); // Locked if poolId provided
    const [status, setStatus] = useState("");
    const [poolState, setPoolState] = useState("UNKNOWN"); // UNKNOWN, CHECKING, INITIALIZED, UNINITIALIZED, INVALID
    const [txStep, setTxStep] = useState(0); // 0: Idle, 1: ApproveTokens, 2: ApprovePermit2, 3: Mint

    const registryAddress = getPoolRegistryAddress(chainId);
    const pmAddress = getPoolManagerAddress(chainId);
    const posmAddress = getPositionManagerAddress(chainId);
    const permit2Address = getPermit2Address(chainId);

    // Load from URL PoolID
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
                setIsLocked(true);
                // Immediately check Slot0 since we trust this ID
                checkSlot0(poolIdParam);
            }).catch(err => {
                console.error(err);
                setStatus("Error loading pool from registry.");
            });
        }
    }, [searchParams, registryAddress, publicClient]);

    // Check Slot0 (Existence)
    const checkSlot0 = async (id) => {
        if (!pmAddress) return;
        setPoolState("CHECKING");
        setStatus("Checking initialization...");
        try {
            const slot0 = await publicClient.readContract({
                address: pmAddress,
                abi: POOL_MANAGER_ABI,
                functionName: "getSlot0",
                args: [id]
            });

            // Logic: Revert checks are caught in catch. Success here means initialized IF price > 0?
            // Actually getSlot0 returns (sqrtPriceX96, ...). If 0, it's not initialized.
            if (slot0 && slot0[0] > 0n) {
                setPoolState("INITIALIZED");
                setStatus("Pool is Initialized. Ready to Mint.");
            } else {
                setPoolState("UNINITIALIZED");
                setStatus("");
            }
        } catch (err) {
            // Revert = Not Initialized
            setPoolState("UNINITIALIZED");
            setStatus("");
        }
    };

    // Manual "Check Pool" for users typing inputs
    const handleCheckPool = async () => {
        if (!tokenA || !tokenB) {
            setStatus("Enter Valid Tokens");
            return;
        }
        if (!registryAddress) return; // Need registry to compute ID helper? Or just do locally?
        // We'll use Registry's computePoolId as a helper since we have it.

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
        if (!permit2Address || !posmAddress) return;
        setStatus("Starting Liquidity Flow...");

        const isNativeA = tokenA === NATIVE_TOKEN_TAG;
        const isNativeB = tokenB === NATIVE_TOKEN_TAG;
        const [c0, c1] = sortTokens(isNativeA ? zeroAddress : tokenA, isNativeB ? zeroAddress : tokenB);

        try {
            // 1. Approve Tokens (Skip Native)
            setTxStep(1);
            if (c0 !== zeroAddress) {
                setStatus(`Approving Token0 (${c0})...`);
                const hash0 = await writeContractAsync({ address: c0, abi: ERC20_ABI, functionName: "approve", args: [permit2Address, maxUint256] });
                await publicClient.waitForTransactionReceipt({ hash: hash0 });
            }
            if (c1 !== zeroAddress) {
                setStatus(`Approving Token1 (${c1})...`);
                const hash1 = await writeContractAsync({ address: c1, abi: ERC20_ABI, functionName: "approve", args: [permit2Address, maxUint256] });
                await publicClient.waitForTransactionReceipt({ hash: hash1 });
            }

            // 2. Approve Permit2 (Skip Native)
            setTxStep(2);
            if (c0 !== zeroAddress) {
                setStatus("Approving Permit2 for Token0...");
                const hashP0 = await writeContractAsync({ address: permit2Address, abi: PERMIT2_ABI, functionName: "approve", args: [c0, posmAddress, maxUint160, maxUint48] });
                await publicClient.waitForTransactionReceipt({ hash: hashP0 });
            }
            if (c1 !== zeroAddress) {
                setStatus("Approving Permit2 for Token1...");
                const hashP1 = await writeContractAsync({ address: permit2Address, abi: PERMIT2_ABI, functionName: "approve", args: [c1, posmAddress, maxUint160, maxUint48] });
                await publicClient.waitForTransactionReceipt({ hash: hashP1 });
            }

            // 3. Mint Stub
            setTxStep(3);
            setStatus("Success! Approvals complete. Mint logic skipped for MVP.");

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
                            <input
                                value={tokenA}
                                onChange={e => setTokenA(e.target.value)}
                                disabled={isLocked}
                                className={`w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm ${isLocked ? 'cursor-not-allowed opacity-70' : ''}`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Token B</label>
                            <input
                                value={tokenB}
                                onChange={e => setTokenB(e.target.value)}
                                disabled={isLocked}
                                className={`w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm ${isLocked ? 'cursor-not-allowed opacity-70' : ''}`}
                            />
                        </div>
                    </div>
                    {/* Fee / Spacing */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Fee</label>
                            <input
                                type="number"
                                value={fee}
                                onChange={e => setFee(e.target.value)}
                                disabled={isLocked}
                                className={`w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm ${isLocked ? 'cursor-not-allowed opacity-70' : ''}`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Tick Spac.</label>
                            <input
                                type="number"
                                value={tickSpacing}
                                onChange={e => setTickSpacing(e.target.value)}
                                disabled={isLocked}
                                className={`w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm ${isLocked ? 'cursor-not-allowed opacity-70' : ''}`}
                            />
                        </div>
                    </div>

                    {/* Check Action (Manual Mode) */}
                    {!isLocked && poolState === "UNKNOWN" && (
                        <button
                            onClick={handleCheckPool}
                            disabled={!tokenA || !tokenB || poolState === "CHECKING"}
                            className="w-full py-2 bg-zinc-200 dark:bg-zinc-800 rounded text-sm font-medium"
                        >
                            {poolState === "CHECKING" ? "Checking..." : "Check Pool Existence"}
                        </button>
                    )}

                    {/* Uninitialized Error State */}
                    {poolState === "UNINITIALIZED" && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                            <h3 className="text-yellow-800 dark:text-yellow-200 font-bold mb-1">Pool Not Initialized</h3>
                            <p className="text-yellow-700 dark:text-yellow-300 text-sm mb-3">
                                This pool does not exist yet. You must initialize it before adding liquidity.
                            </p>
                            <a href="/pools/initialize" className="block w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-center rounded text-sm font-bold">
                                Go to Initialize Pool
                            </a>
                        </div>
                    )}

                    {/* Initialized / Active State */}
                    {poolState === "INITIALIZED" && (
                        <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
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

                            <button
                                onClick={handleAddLiquidity}
                                disabled={!isConnected || txStep > 0}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded"
                            >
                                {txStep > 0 ? "Processing..." : "Add Liquidity"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Status Bar */}
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
