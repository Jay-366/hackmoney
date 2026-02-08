'use client';

import { useState } from 'react';
import {
    ShieldCheck,
    MoreHorizontal,
    Activity,
    Globe,
    Code,
    BarChart2,
    Repeat,
    Heart,
    ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RegistrationFile {
    name: string | null;
    ens: string | null;
    webEndpoint: string | null;
}

export interface Agent {
    agentId: string;
    owner: string;
    agentURI: string;
    score: string | null;
    totalFeedback: string;
    lastActivity: string;
    registrationFile: RegistrationFile | null;
}

interface AgentCardProps {
    agent: Agent;
    onToggleLike: (id: string) => void;
    isLiked: boolean;
}

// 8004scan base URL for agent details
const SCAN_BASE_URL = 'https://testnet.8004scan.io/agents/sepolia';

export function AgentCard({ agent, onToggleLike, isLiked }: AgentCardProps) {
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
    // Safe parse for color index
    const colorIndex = parseInt(agent.agentId || '0', 10) % colors.length;
    const gradientColor = colors[Number.isNaN(colorIndex) ? 0 : colorIndex];

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

    const scanUrl = `${SCAN_BASE_URL}/${agent.agentId}`;

    return (
        <a
            href={scanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
        >
            <article className="group glass-panel rounded-[2rem] p-6 transition-all duration-500 hover:bg-white/[0.05] border border-white/[0.04] h-[220px] flex flex-col justify-between cursor-pointer hover:border-[#FD7C9F]/20">
                <div className="flex gap-6 flex-col sm:flex-row h-full">
                    {/* Left Side: Avatar */}
                    <div className="flex-shrink-0">
                        <div className="w-16 h-16 rounded-full glass-panel flex items-center justify-center text-3xl relative overflow-hidden">
                            <div className={`absolute inset-0 bg-gradient-to-br ${gradientColor} opacity-20`}></div>
                            <span className="relative z-10">🤖</span>
                        </div>
                    </div>

                    {/* Right Side: Content Area */}
                    <div className="flex-1 min-w-0 flex flex-col h-full">
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
                        </div>

                        {/* Description / Meta Info */}
                        <div className="font-sans-airy text-[1.05rem] leading-relaxed text-slate-300 font-light mb-auto space-y-2 mt-2">
                            {webEndpoint && (
                                <div className="flex items-center gap-2 text-sm text-slate-400 truncate">
                                    <Globe size={14} className="text-[#FD7C9F]/70" />
                                    <a href={webEndpoint} target="_blank" rel="noopener noreferrer" className="hover:text-[#FD7C9F] transition-colors truncate z-20 relative">
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
                                <span className="text-[#FD7C9F]/70 text-sm font-light lowercase">
                                    #{agent.agentId}
                                </span>
                                <span className="text-[#FD7C9F]/70 text-sm font-light lowercase">
                                    owner: {truncateAddress(agent.owner)}
                                </span>
                            </div>
                        </div>

                        {/* Stats & Actions */}
                        <div className="flex items-center gap-4 sm:gap-8 pt-2 flex-wrap border-t border-white/[0.04] mt-auto pt-4">
                            <div className="flex items-center gap-2 text-slate-200/90" title="Reputation Score">
                                <BarChart2 size={16} />
                                <span className="text-sm font-sans-airy font-light whitespace-nowrap">
                                    Score {agent.score ? parseFloat(agent.score).toFixed(2) : '0.00'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-200/90" title="Total Feedback">
                                <Repeat size={16} />
                                <span className="text-sm font-sans-airy font-light whitespace-nowrap">
                                    Feedback {agent.totalFeedback}
                                </span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleLike(agent.agentId);
                                }}
                                className={`flex items-center gap-3 py-1.5 px-4 rounded-full transition-all duration-300 border ml-auto z-20 relative ${isLiked
                                    ? 'bg-[#FD7C9F]/10 text-[#FD7C9F] border-[#FD7C9F]/20'
                                    : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <Heart
                                    size={18}
                                    className={`transition-all ${isLiked ? 'fill-[#FD7C9F]' : ''}`}
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        </a>
    );
}
