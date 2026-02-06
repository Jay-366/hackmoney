'use client';

import { useState } from 'react';
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
    Plus
} from 'lucide-react';

export default function Register() {
    const [agents, setAgents] = useState([
        {
            id: 1,
            name: 'Trading Agent 1',
            handle: "@tradingagent1",
            avatar: '🤖',
            color: 'from-blue-500 to-purple-600',
            status: 'Active',
            transactions: 1420,
            reputation: 87,
            description: 'Specialized in high-frequency crypto trading with risk management algorithms. Built for volatility and precision entry strategies.',
            createdAt: '9h ago',
            tags: ["#crypto", "#trading", "#defi"]
        },
        {
            id: 2,
            name: 'Trading Agent 2',
            handle: "@tradingagent2",
            avatar: '🤖',
            color: 'from-emerald-500 to-teal-600',
            status: 'Active',
            transactions: 892,
            reputation: 94,
            description: 'Automated arbitrage specialist focusing on cross-chain liquidity pools. Optimized for low-slippage execution and yield maximization.',
            createdAt: '2d ago',
            tags: ["#arbitrage", "#automation", "#liquidity"]
        }
    ]);

    const [likedAgents, setLikedAgents] = useState({});

    const toggleLike = (id) => {
        setLikedAgents(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="min-h-screen bg-[#121418] text-slate-200 font-sans selection:bg-[#FD7C9F]/30 overflow-x-hidden relative">
            {/* Navbar Wrapper - Centered at Top */}
            <div className="fixed top-0 left-0 w-full z-50 flex justify-center py-6 pointer-events-none">
                <div className="pointer-events-auto">
                    <BottomNavBar
                        items={[
                            { label: "Home", icon: Home },
                            { label: "Dashboard", icon: LayoutDashboard },
                            { label: "Network", icon: Users },
                            { label: "Analytics", icon: LineChart },
                        ]}
                        defaultIndex={2}
                        stickyBottom={false}
                        className="glass-panel text-sm !border-white/[0.08] !bg-white/[0.03]"
                    />
                </div>
            </div>

            {/* Top Right Controls (Bell, Create) - Absolute to match design placement if needed, or just keep simple */}
            <div className="fixed top-6 right-10 z-50 flex items-center gap-4 hidden lg:flex">
                <button className="luminous-accent text-white px-6 py-2.5 rounded-full flex items-center gap-2 font-medium transition-all hover:brightness-110 active:scale-95 shadow-[0_0_20px_rgba(253,124,159,0.3)]">
                    <Plus size={18} />
                    <span className="text-sm">Create Agent</span>
                </button>
            </div>


            {/* Main Content */}
            <main className="relative z-10 pt-32 pb-20 max-w-3xl mx-auto px-6">
                <header className="mb-10 text-center">
                    <h1 className="font-serif text-7xl italic font-light tracking-tight mb-8 opacity-90 text-white">
                        Agent Lists
                    </h1>
                    <div className="flex justify-center items-center">
                        <div className="w-full max-lg h-[1px] bg-gradient-to-r from-transparent via-slate-700/40 to-transparent"></div>
                    </div>
                </header>

                {/* Agent Feed */}
                <div className="space-y-6">
                    {agents.map((agent) => (
                        <article
                            key={agent.id}
                            className="group glass-panel rounded-[2rem] p-8 transition-all duration-500 hover:bg-white/[0.05] border border-white/[0.04]"
                        >
                            <div className="flex gap-6 flex-col sm:flex-row">
                                {/* Left Side: Avatar */}
                                <div className="flex-shrink-0">
                                    <div className="w-16 h-16 rounded-full glass-panel flex items-center justify-center text-3xl relative overflow-hidden">
                                        <div className={`absolute inset-0 bg-gradient-to-br ${agent.color} opacity-20`}></div>
                                        <span className="relative z-10">{agent.avatar}</span>
                                    </div>
                                </div>

                                {/* Right Side: Content Area */}
                                <div className="flex-1 min-w-0">
                                    {/* Header Row */}
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xl font-bold text-white hover:underline cursor-pointer">
                                                {agent.name}
                                            </span>
                                            <ShieldCheck size={16} className="text-[#FD7C9F] flex-shrink-0" />
                                            <span className="text-slate-500 font-sans-airy text-sm ml-1 truncate">{agent.handle}</span>
                                            <span className="text-slate-600 mx-1">·</span>
                                            <span className="text-slate-500 font-sans-airy text-sm">{agent.createdAt}</span>
                                        </div>
                                        <button className="text-slate-500 hover:text-white transition-colors">
                                            <MoreHorizontal size={20} />
                                        </button>
                                    </div>

                                    {/* Description Text */}
                                    <div className="font-sans-airy text-[1.05rem] leading-relaxed text-slate-300 font-light mb-4">
                                        {agent.description}
                                        <div className="mt-4 flex flex-wrap gap-2 sm:gap-4">
                                            {agent.tags.map(tag => (
                                                <span key={tag} className="text-[#FD7C9F]/70 text-sm font-light lowercase hover:underline cursor-pointer hover:text-[#FD7C9F]">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Stats & Actions */}
                                    <div className="flex items-center gap-4 sm:gap-8 pt-2 flex-wrap">
                                        {/* Reputation Stat */}
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <BarChart2 size={16} />
                                            <span className="text-sm font-sans-airy font-light whitespace-nowrap">
                                                Reputation {agent.reputation}%
                                            </span>
                                        </div>

                                        {/* Transaction Stat */}
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <Repeat size={16} />
                                            <span className="text-sm font-sans-airy font-light whitespace-nowrap">
                                                Transactions {agent.transactions.toLocaleString()}
                                            </span>
                                        </div>

                                        {/* Collect Button */}
                                        <button
                                            onClick={() => toggleLike(agent.id)}
                                            className={`flex items-center gap-3 py-1.5 px-4 rounded-full transition-all duration-300 border ml-auto ${likedAgents[agent.id]
                                                ? 'bg-[#FD7C9F]/10 text-[#FD7C9F] border-[#FD7C9F]/20'
                                                : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
                                                }`}
                                        >
                                            <Heart
                                                size={18}
                                                className={`transition-all ${likedAgents[agent.id] ? 'fill-[#FD7C9F]' : ''}`}
                                            />
                                            <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Collect</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>


            </main>
        </div>
    );
}
