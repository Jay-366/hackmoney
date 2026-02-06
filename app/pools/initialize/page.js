"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { getPoolRegistryAddress, getPoolManagerAddress, getPriceImpactHookAddress, ANVIL_CHAIN_ID, SEPOLIA_CHAIN_ID } from "@/lib/uniswapV4Addresses";
import { POOL_REGISTRY_ABI } from "@/lib/poolRegistryAbi";
import { POOL_MANAGER_ABI } from "@/lib/poolManagerAbi";
import { sortTokens } from "@/lib/sortTokens";
import { isAddress, zeroAddress } from "viem";

const NATIVE_TOKEN_TAG = "NATIVE";

export default function InitializePoolPage() {
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();

    // Inputs
    const [tokenA, setTokenA] = useState("");
    const [tokenB, setTokenB] = useState("");
    const [fee, setFee] = useState("3000"); // Pips
    const [tickSpacing, setTickSpacing] = useState("60");
    const [startingPriceX96, setStartingPriceX96] = useState("79228162514264337593543950336"); // 1:1
    const [hookAddress, setHookAddress] = useState(zeroAddress);

    const [status, setStatus] = useState("");
    const [txHash, setTxHash] = useState("");
    const [regHash, setRegHash] = useState("");

    const registryAddress = getPoolRegistryAddress(chainId);
    const pmAddress = getPoolManagerAddress(chainId);

    // Set defaults based on chain
    useEffect(() => {
        if (tokenA || tokenB) return;
        if (chainId === ANVIL_CHAIN_ID) {
            setTokenA('0x0165878A594ca255338adfa4d48449f69242Eb8F');
            setTokenB('0xa513E6E4b8f2a923D98304ec87F64353C4D5C853');
        } else if (chainId === SEPOLIA_CHAIN_ID) {
            setTokenA(NATIVE_TOKEN_TAG); // ETH default for A
            setTokenB('0xe6ba97E2d85B1d0474AAbDd0969C0C4670377d0E');

            // Set default hook
            const defaultHook = getPriceImpactHookAddress(chainId);
            if (defaultHook) setHookAddress(defaultHook);
        }
    }, [chainId, tokenA, tokenB]);


    const handleInitialize = async () => {
        if (!pmAddress || !registryAddress) {
            setStatus("Error: Contracts not found for this chain.");
            return;
        }

        setStatus("");
        setTxHash("");
        setRegHash("");

        try {
            // Validate Addresses
            const isNativeA = tokenA === NATIVE_TOKEN_TAG;
            const isNativeB = tokenB === NATIVE_TOKEN_TAG;

            if (!isNativeA && !isAddress(tokenA)) throw new Error("Invalid Token A Address");
            if (!isNativeB && !isAddress(tokenB)) throw new Error("Invalid Token B Address");
            if (!isAddress(hookAddress)) throw new Error("Invalid Hook Address");

            // Sort
            const [c0, c1] = sortTokens(
                isNativeA ? zeroAddress : tokenA,
                isNativeB ? zeroAddress : tokenB
            );

            // Pool Key
            const poolKey = {
                currency0: c0,
                currency1: c1,
                fee: parseInt(fee),
                tickSpacing: parseInt(tickSpacing),
                hooks: hookAddress
            };

            // 1. Initialize
            setStatus("Initializing Pool on PoolManager...");
            const hash = await writeContractAsync({
                address: pmAddress,
                abi: POOL_MANAGER_ABI,
                functionName: "initialize",
                args: [poolKey, BigInt(startingPriceX96)]
            });
            setTxHash(hash);
            setStatus("Waiting for Initialization confirmation...");
            await publicClient.waitForTransactionReceipt({ hash });

            // 2. Register
            setStatus("Registering Pool in Registry...");
            const rHash = await writeContractAsync({
                address: registryAddress,
                abi: POOL_REGISTRY_ABI,
                functionName: "register",
                args: [poolKey]
            });
            setRegHash(rHash);
            setStatus("Waiting for Registration confirmation...");
            await publicClient.waitForTransactionReceipt({ hash: rHash });

            setStatus("Success! Pool Initialized and Registered.");

        } catch (err) {
            console.error(err);
            // Decode potential errors if needed, generic for now
            let msg = err.message || "Unknown error";
            if (msg.includes("Pool already initialized")) msg = "Pool already initialized.";
            setStatus(`Error: ${msg}`);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center bg-zinc-50 dark:bg-black font-sans">
            <header className="w-full max-w-5xl flex justify-between items-center py-6 px-8">
                <h1 className="text-3xl font-bold text-black dark:text-zinc-50">Initialize Pool</h1>
                <div className="flex gap-4">
                    <a href="/pools" className="px-4 py-2 text-sm text-zinc-500 hover:text-black dark:text-zinc-400">Back to Pools</a>
                    <ConnectButton />
                </div>
            </header>

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800">
                <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Token A (or "{NATIVE_TOKEN_TAG}")</label>
                            <input value={tokenA} onChange={e => setTokenA(e.target.value)} className="w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Token B</label>
                            <input value={tokenB} onChange={e => setTokenB(e.target.value)} className="w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Fee (pips)</label>
                            <select value={fee} onChange={e => setFee(e.target.value)} className="w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm">
                                <option value="100">0.01% (100)</option>
                                <option value="500">0.05% (500)</option>
                                <option value="3000">0.30% (3000)</option>
                                <option value="10000">1.00% (10000)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500">Tick Spacing</label>
                            <input type="number" value={tickSpacing} onChange={e => setTickSpacing(e.target.value)} className="w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500">Start Price X96</label>
                        <input value={startingPriceX96} onChange={e => setStartingPriceX96(e.target.value)} className="w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500">Hook Address</label>
                        <input value={hookAddress} onChange={e => setHookAddress(e.target.value)} className="w-full p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono" />
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="text-sm text-center min-h-[1.5em] font-medium p-2 break-all">
                        {status}
                    </div>

                    <button
                        onClick={handleInitialize}
                        disabled={!isConnected || (!!status && status.startsWith("Initializing"))}
                        className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-bold rounded hover:opacity-90 disabled:opacity-50"
                    >
                        Initialize & Register
                    </button>

                    {txHash && (
                        <div className="text-xs text-center text-zinc-500">
                            Init Tx: <span className="font-mono text-black dark:text-white">{txHash.slice(0, 10)}...</span>
                        </div>
                    )}
                    {regHash && (
                        <div className="text-xs text-center text-zinc-500">
                            Register Tx: <span className="font-mono text-black dark:text-white">{regHash.slice(0, 10)}...</span>
                        </div>
                    )}

                    {status.includes("Success") && (
                        <div className="flex gap-2 mt-4">
                            <a href="/pools" className="flex-1 text-center py-2 bg-zinc-200 dark:bg-zinc-800 rounded">Go to Pools List</a>
                            <a href="/positions/create" className="flex-1 text-center py-2 bg-indigo-600 text-white rounded">Add Liquidity</a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
