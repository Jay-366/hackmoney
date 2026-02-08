"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { getPoolRegistryAddress } from "@/lib/uniswapV4Addresses";
import { POOL_REGISTRY_ABI } from "@/lib/poolRegistryAbi";

export default function PoolsPage() {
    const chainId = useChainId();
    const publicClient = usePublicClient();

    // Registry & List State
    const [pools, setPools] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const pageSize = 10;

    const registryAddress = getPoolRegistryAddress(chainId);

    // Fetch Pools
    const fetchPools = async () => {
        if (!registryAddress || !publicClient) return;
        setLoading(true);
        setPools([]);
        try {
            const total = await publicClient.readContract({
                address: registryAddress,
                abi: POOL_REGISTRY_ABI,
                functionName: "totalPools",
            });

            const count = Number(total);
            if (count === 0) {
                setLoading(false);
                return;
            }

            const start = BigInt(page * pageSize);
            const limit = BigInt(pageSize);

            const poolIds = await publicClient.readContract({
                address: registryAddress,
                abi: POOL_REGISTRY_ABI,
                functionName: "listPoolIds",
                args: [start, limit],
            });

            const poolDetails = await Promise.all(
                poolIds.map(async (id) => {
                    const info = await publicClient.readContract({
                        address: registryAddress,
                        abi: POOL_REGISTRY_ABI,
                        functionName: "getPool",
                        args: [id],
                    });
                    return { id, ...info };
                })
            );
            setPools(poolDetails);
        } catch (err) {
            console.error("Error fetching pools:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPools();
    }, [chainId, page, registryAddress]);

    return (
        <div className="flex min-h-screen flex-col items-center bg-zinc-50 dark:bg-black font-sans">
            {/* Header */}
            <header className="w-full max-w-5xl flex justify-between items-center py-6 px-8">
                <h1 className="text-3xl font-bold text-black dark:text-zinc-50">Pools</h1>
                <div className="flex gap-4">
                    <button
                        onClick={fetchPools}
                        className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
                    >
                        Refresh
                    </button>
                    <a
                        href="/pools/initialize"
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-black rounded font-medium transition-colors"
                    >
                        Initialize Pool
                    </a>
                    <a
                        href="/positions/create"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold transition-colors"
                    >
                        New Position
                    </a>
                    <ConnectButton />
                </div>
            </header>

            {/* Debug Info */}
            <div className="w-full max-w-5xl px-8 mb-4 text-xs text-zinc-400 font-mono">
                <p>Chain ID: {chainId}</p>
                <p>Registry: {registryAddress || "Not Found"}</p>
                {/* <p>Env: {process.env.NEXT_PUBLIC_POOL_REGISTRY}</p> */}
            </div>

            {/* Main Content */}
            <main className="w-full max-w-5xl px-8 pb-12">
                {/* List */}
                {loading ? (
                    <p className="text-zinc-500">Loading pools...</p>
                ) : pools.length === 0 ? (
                    <p className="text-zinc-500">No pools found in registry.</p>
                ) : (
                    <div className="w-full overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                <tr>
                                    <th className="p-4 font-medium">Token 0</th>
                                    <th className="p-4 font-medium">Token 1</th>
                                    <th className="p-4 font-medium">Fee</th>
                                    <th className="p-4 font-medium">Tick Spacing</th>
                                    <th className="p-4 font-medium">Hook</th>
                                    <th className="p-4 font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                                {pools.map((pool) => (
                                    <tr key={pool.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <td className="p-4 font-mono">{pool.currency0}</td>
                                        <td className="p-4 font-mono">{pool.currency1}</td>
                                        <td className="p-4">{pool.fee}</td>
                                        <td className="p-4">{pool.tickSpacing}</td>
                                        <td className="p-4 font-mono text-xs text-zinc-500">
                                            {pool.hooks === "0x0000000000000000000000000000000000000000" ? "None" : pool.hooks}
                                        </td>
                                        <td className="p-4">
                                            <a
                                                href={`/positions/create?poolId=${pool.id}`}
                                                className="text-indigo-600 hover:text-indigo-500 font-medium"
                                            >
                                                Add Liquidity
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                <div className="flex justify-center gap-4 mt-6">
                    <button
                        disabled={page === 0}
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        className="px-4 py-2 rounded bg-zinc-200 dark:bg-zinc-800 disabled:opacity-50"
                    >
                        Prev
                    </button>
                    <button
                        disabled={pools.length < pageSize}
                        onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 rounded bg-zinc-200 dark:bg-zinc-800 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </main>
        </div>
    );
}
