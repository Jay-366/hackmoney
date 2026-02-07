'use client';

import { useState, useEffect, useCallback } from 'react';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import {
    LayoutDashboard,
    Users,
    LineChart,
    Settings,
    Home,
    ShieldCheck,
    MoreHorizontal,
    BarChart2,
    Repeat,
    Heart,
    Plus,
    Search,
    ExternalLink,
    Code,
    Globe,
    Activity
} from 'lucide-react';
import Link from 'next/link';

interface RegistrationFile {
    name: string | null;
    ens: string | null;
    webEndpoint: string | null;
}

interface Agent {
    agentId: string;
    owner: string;
    agentURI: string;
    score: string | null;
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

    // Mock liked state for UI interaction consistency
    const [likedAgents, setLikedAgents] = useState<Record<string, boolean>>({});

    const toggleLike = (id: string) => {
        setLikedAgents(prev => ({ ...prev, [id]: !prev[id] }));
    };

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

    // Helper to render an agent card (reused for list & search result)
    const AgentCard = ({ agent }: { agent: Agent }) => {
        const displayName = agent.registrationFile?.name || `Agent #${agent.agentId}`;
        const displayHandle = agent.registrationFile?.ens;
        const webEndpoint = agent.registrationFile?.webEndpoint;
        const agentURI = agent.agentURI;

        // Generate a deterministic gradient based on ID
        const colors = [
            'from-blue-500 to-purple-600',
            'from-emerald-500 to-teal-600',
            'from-orange-500 to-red-600',
            'from-pink-500 to-rose-600',
            'from-cyan-500 to-blue-600',
        ];
        const colorIndex = parseInt(agent.agentId) % colors.length;
        const gradientColor = colors[colorIndex];

        return (
            <article className="group glass-panel rounded-[2rem] p-8 transition-all duration-500 hover:bg-white/[0.05] border border-white/[0.04]">
                <div className="flex gap-6 flex-col sm:flex-row">
                    {/* Left Side: Avatar */}
                    <div className="flex-shrink-0">
                        <div className="w-16 h-16 rounded-full glass-panel flex items-center justify-center text-3xl relative overflow-hidden">
                            <div className={`absolute inset-0 bg-gradient-to-br ${gradientColor} opacity-20`}></div>
                            <span className="relative z-10">🤖</span>
                        </div>
                    </div>

                    {/* Right Side: Content Area */}
                    <div className="flex-1 min-w-0">
                        {/* Header Row */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xl font-bold text-white hover:underline cursor-pointer">
                                    {displayName}
                                </span>
                                <ShieldCheck size={16} className="text-[#FD7C9F] flex-shrink-0" />
                                {displayHandle && <span className="text-slate-500 font-sans-airy text-sm ml-1 truncate">{displayHandle}</span>}
                                <span className="text-slate-600 mx-1">·</span>
                                <span className="text-slate-500 font-sans-airy text-sm flex items-center gap-1">
                                    <Activity size={12} /> {formatTimestamp(agent.lastActivity)}
                                </span>
                            </div>
                            <button className="text-slate-500 hover:text-white transition-colors">
                                <MoreHorizontal size={20} />
                            </button>
                        </div>

                        {/* Description / Meta Info */}
                        <div className="font-sans-airy text-[1.05rem] leading-relaxed text-slate-300 font-light mb-4 space-y-2">
                            {webEndpoint && (
                                <div className="flex items-center gap-2 text-sm text-slate-400 truncate">
                                    <Globe size={14} className="text-[#FD7C9F]/70" />
                                    <a href={webEndpoint} target="_blank" rel="noopener noreferrer" className="hover:text-[#FD7C9F] transition-colors truncate">
                                        {webEndpoint}
                                    </a>
                                </div>
                            )}
                            {agentURI && (
                                <div className="flex items-center gap-2 text-sm text-slate-400 truncate">
                                    <Code size={14} className="text-[#FD7C9F]/70" />
                                    <span className="truncate" title={agentURI}>{agentURI}</span>
                                </div>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2 sm:gap-4 pt-2">
                                <span className="text-[#FD7C9F]/70 text-sm font-light lowercase hover:underline cursor-pointer hover:text-[#FD7C9F]">
                                    #{agent.agentId}
                                </span>
                                <span className="text-[#FD7C9F]/70 text-sm font-light lowercase hover:underline cursor-pointer hover:text-[#FD7C9F]">
                                    owner: {truncateAddress(agent.owner)}
                                </span>
                            </div>
                        </div>

                        {/* Stats & Actions */}
                        <div className="flex items-center gap-4 sm:gap-8 pt-2 flex-wrap border-t border-white/[0.04] mt-4 pt-4">
                            {/* Score Stat */}
                            <div className="flex items-center gap-2 text-slate-500" title="Reputation Score">
                                <BarChart2 size={16} />
                                <span className="text-sm font-sans-airy font-light whitespace-nowrap">
                                    Score {agent.score ? parseFloat(agent.score).toFixed(2) : '0.00'}
                                </span>
                            </div>

                            {/* Feedback Stat */}
                            <div className="flex items-center gap-2 text-slate-500" title="Total Feedback">
                                <Repeat size={16} />
                                <span className="text-sm font-sans-airy font-light whitespace-nowrap">
                                    Feedback {agent.totalFeedback}
                                </span>
                            </div>

                            {/* Collect/Like Button */}
                            <button
                                onClick={() => toggleLike(agent.agentId)}
                                className={`flex items-center gap-3 py-1.5 px-4 rounded-full transition-all duration-300 border ml-auto ${likedAgents[agent.agentId]
                                    ? 'bg-[#FD7C9F]/10 text-[#FD7C9F] border-[#FD7C9F]/20'
                                    : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <Heart
                                    size={18}
                                    className={`transition-all ${likedAgents[agent.agentId] ? 'fill-[#FD7C9F]' : ''}`}
                                />
                                {/* <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Collect</span> */}
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        );
    };

    return (
        <div className="min-h-screen bg-[#121418] text-slate-200 font-sans selection:bg-[#FD7C9F]/30 overflow-x-hidden relative">
            {/* Navbar Wrapper - Centered at Top */}
            <div className="fixed top-0 left-0 w-full z-50 flex justify-center py-6 pointer-events-none">
                <div className="pointer-events-auto">
                    <BottomNavBar
                        defaultIndex={2} // "Agents" tab index
                        stickyBottom={false}
                        className="glass-panel text-sm !border-white/[0.08] !bg-white/[0.03]"
                    />
                </div>
            </div>

            {/* Main Content */}
            <main className="relative z-10 pt-32 pb-20 max-w-3xl mx-auto px-6">
                <header className="mb-10 text-center">
                    <h1 className="font-serif text-7xl italic font-light tracking-tight mb-8 opacity-90 text-white">
                        Browse Agents
                    </h1>
                    <div className="flex justify-center items-center">
                        <div className="w-full max-lg h-[1px] bg-gradient-to-r from-transparent via-slate-700/40 to-transparent"></div>
                    </div>
                    <p className="text-[#fd7c9f] mt-4 text-lg font-light font-sans-airy">
                        Explore autonomous agents registered on the ERC-8004 registry
                    </p>
                </header>

                {/* Search Section */}
                <div className="mb-10 relative">
                    <form onSubmit={handleSearch} className="relative z-10 w-full max-w-md mx-auto font-sans">
                        <label className="relative flex items-center w-full h-12 px-12 z-0">
                            {/* Input */}
                            <input
                                className="peer w-full h-full bg-transparent border-none outline-none text-slate-200 placeholder-white/90 font-sans-airy text-sm z-10"
                                type="text"
                                value={searchId}
                                onChange={(e) => setSearchId(e.target.value)}
                                placeholder="Search by Agent ID..."
                                required
                            />

                            {/* Fancy Background (border/bg change on focus) */}
                            <div className="absolute inset-0 w-full h-full bg-[#585858] rounded-full -z-10 shadow-sm transition-all duration-300 peer-focus:bg-[#121418] peer-focus:border peer-focus:border-[#FD7C9F] peer-focus:shadow-[0_0_20px_rgba(253,124,159,0.2)]"></div>

                            {/* Search Icon (Left) */}
                            <div className="absolute left-4 text-slate-500 transition-colors duration-300 peer-focus:text-[#FD7C9F] z-10">
                                <Search size={18} />
                            </div>

                            {/* Close/Clear Button (Right) */}
                            <button
                                type="button"
                                onClick={clearSearch}
                                className={`absolute right-4 w-5 h-5 rounded-full bg-[#FD7C9F] text-[#121418] flex items-center justify-center transition-all duration-300 z-10 ${searchId ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-90'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </label>
                        {/* Hidden submit button to allow Enter key submission */}
                        <button type="submit" className="hidden"></button>
                    </form>

                    {/* Search Error */}
                    {searchError && (
                        <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-center font-light">
                            {searchError}
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="space-y-6">
                    {/* Search Result View */}
                    {searchResult ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-4 px-2">
                                <h3 className="text-[#FD7C9F] tracking-wide uppercase text-xs font-bold">Search Result</h3>
                                <button onClick={clearSearch} className="text-slate-400 hover:text-white text-xs underline">Back to List</button>
                            </div>
                            <AgentCard agent={searchResult} />
                        </div>
                    ) : (
                        /* List View */
                        <>
                            {loading ? (
                                <div className="py-20 text-center">
                                    <div className="inline-block w-8 h-8 border-2 border-[#FD7C9F] border-t-transparent rounded-full animate-spin mb-4"></div>
                                    <p className="text-slate-500 font-light tracking-wide">Loading agents form chain...</p>
                                </div>
                            ) : error ? (
                                <div className="py-12 text-center bg-red-500/5 rounded-2xl border border-red-500/10">
                                    <p className="text-red-300 mb-4">{error}</p>
                                    <button
                                        onClick={fetchAgentsList}
                                        className="text-white underline hover:no-underline"
                                    >
                                        Try again
                                    </button>
                                </div>
                            ) : agents.length === 0 ? (
                                <div className="py-20 text-center">
                                    <p className="text-slate-500 font-light text-xl">No agents found.</p>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in duration-700">
                                    {agents.map((agent) => (
                                        <AgentCard key={agent.agentId} agent={agent} />
                                    ))}
                                </div>
                            )}

                            {/* Pagination */}
                            {!loading && agents.length > 0 && (
                                <div className="pt-10 flex items-center justify-between border-t border-white/[0.04] mt-8">
                                    <button
                                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                                        disabled={page === 0 || loading}
                                        className="glass-button px-6 py-2.5 rounded-full text-sm text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        ← Previous
                                    </button>
                                    <span className="text-slate-500 font-mono text-sm">
                                        Page {page + 1}
                                    </span>
                                    <button
                                        onClick={() => setPage((p) => p + 1)}
                                        disabled={!hasMore || loading}
                                        className="glass-button px-6 py-2.5 rounded-full text-sm text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        Next →
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
