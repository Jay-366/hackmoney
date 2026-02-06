'use client';

import { useState, useEffect, useCallback } from 'react';

interface RegistrationFile {
    name: string | null;
    ens: string | null;
    webEndpoint: string | null;
}

interface Agent {
    agentId: string;
    owner: string;
    agentURI: string;
    totalFeedback: string;
    lastActivity: string;
    registrationFile: RegistrationFile | null;
}

interface AgentsResponse {
    agents: Agent[];
    pagination: {
        first: number;
        skip: number;
        count: number;
    };
}

interface SingleAgentResponse {
    agent?: Agent;
    error?: string;
}

const PAGE_SIZE = 20;

export default function AgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Search state
    const [searchId, setSearchId] = useState('');
    const [searchResult, setSearchResult] = useState<Agent | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searching, setSearching] = useState(false);

    const fetchAgentsList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const skip = page * PAGE_SIZE;
            const res = await fetch(`/api/agents?first=${PAGE_SIZE}&skip=${skip}`);
            const data: AgentsResponse & { error?: string } = await res.json();

            if (!res.ok || data.error) {
                throw new Error(data.error || 'Failed to fetch agents');
            }

            setAgents(data.agents);
            setHasMore(data.agents.length === PAGE_SIZE);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchAgentsList();
    }, [fetchAgentsList]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchId.trim()) return;

        setSearching(true);
        setSearchResult(null);
        setSearchError(null);

        try {
            const res = await fetch(`/api/agents/${searchId.trim()}`);
            const data: SingleAgentResponse = await res.json();

            if (!res.ok || data.error) {
                setSearchError(data.error || 'Not found');
            } else if (data.agent) {
                setSearchResult(data.agent);
            }
        } catch (err) {
            setSearchError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setSearching(false);
        }
    };

    const clearSearch = () => {
        setSearchId('');
        setSearchResult(null);
        setSearchError(null);
    };

    const truncateAddress = (addr: string) => {
        if (!addr) return '-';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const formatTimestamp = (ts: string) => {
        if (!ts || ts === '0') return '-';
        const date = new Date(parseInt(ts) * 1000);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 md:p-10">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                        Browse Agents
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Explore autonomous agents registered on the ERC-8004 registry
                    </p>
                </div>

                {/* Search Section */}
                <div className="mb-8 p-6 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                    <h2 className="text-lg font-semibold mb-4 text-slate-200">Search by Agent ID</h2>
                    <form onSubmit={handleSearch} className="flex gap-3">
                        <input
                            type="text"
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            placeholder="Enter Agent ID (e.g., 123)"
                            className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-slate-500"
                        />
                        <button
                            type="submit"
                            disabled={searching || !searchId.trim()}
                            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-medium hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {searching ? 'Searching...' : 'Search'}
                        </button>
                        {(searchResult || searchError) && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="px-4 py-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </form>

                    {/* Search Result */}
                    {searchResult && (
                        <div className="mt-4 p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-lg">
                            <h3 className="text-emerald-400 font-medium mb-2">Agent Found</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-400">Agent ID:</span>
                                    <p className="text-white font-mono">{searchResult.agentId}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400">Owner:</span>
                                    <p className="text-white font-mono">{truncateAddress(searchResult.owner)}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400">Name:</span>
                                    <p className="text-white">{searchResult.registrationFile?.name || '-'}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400">ENS:</span>
                                    <p className="text-white">{searchResult.registrationFile?.ens || '-'}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-slate-400">Web Endpoint:</span>
                                    <p className="text-cyan-400 break-all">
                                        {searchResult.registrationFile?.webEndpoint || '-'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-slate-400">Total Feedback:</span>
                                    <p className="text-white">{searchResult.totalFeedback}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400">Last Activity:</span>
                                    <p className="text-white">{formatTimestamp(searchResult.lastActivity)}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {searchError && (
                        <div className="mt-4 p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
                            <p className="text-red-400">{searchError}</p>
                        </div>
                    )}
                </div>

                {/* Error State */}
                {error && (
                    <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
                        <p className="text-red-400">{error}</p>
                        <button
                            onClick={fetchAgentsList}
                            className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* Agents Table */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-900/50">
                                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent ID</th>
                                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Owner</th>
                                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">ENS</th>
                                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Web Endpoint</th>
                                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent URI</th>
                                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Feedback</th>
                                    <th className="px-4 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Activity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                                                <span className="text-slate-400">Loading agents...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : agents.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                                            No agents found
                                        </td>
                                    </tr>
                                ) : (
                                    agents.map((agent) => (
                                        <tr key={agent.agentId} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="px-4 py-4 font-mono text-cyan-400">{agent.agentId}</td>
                                            <td className="px-4 py-4 font-mono text-sm text-slate-300">{truncateAddress(agent.owner)}</td>
                                            <td className="px-4 py-4 text-slate-200">{agent.registrationFile?.name || '-'}</td>
                                            <td className="px-4 py-4 text-slate-300">{agent.registrationFile?.ens || '-'}</td>
                                            <td className="px-4 py-4 max-w-[200px] truncate text-sm text-slate-400">
                                                {agent.registrationFile?.webEndpoint || '-'}
                                            </td>
                                            <td className="px-4 py-4 max-w-[150px] truncate text-sm text-slate-400">
                                                {agent.agentURI || '-'}
                                            </td>
                                            <td className="px-4 py-4 text-slate-200">{agent.totalFeedback}</td>
                                            <td className="px-4 py-4 text-slate-400 text-sm">{formatTimestamp(agent.lastActivity)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-4 py-4 bg-slate-900/30 border-t border-slate-700/50 flex items-center justify-between">
                        <p className="text-sm text-slate-400">
                            Showing page {page + 1} ({agents.length} agents)
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0 || loading}
                                className="px-4 py-2 bg-slate-700 rounded-lg text-sm font-medium hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                ← Prev
                            </button>
                            <button
                                onClick={() => setPage((p) => p + 1)}
                                disabled={!hasMore || loading}
                                className="px-4 py-2 bg-slate-700 rounded-lg text-sm font-medium hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
