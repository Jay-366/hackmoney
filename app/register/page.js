'use client';

import { useState } from 'react';
import { BottomNavBar } from '@/components/ui/bottom-nav-bar';
import { LayoutDashboard, Users, LineChart, Settings, Home } from 'lucide-react';

export default function Register() {
    const [agents, setAgents] = useState([
        {
            id: 1,
            name: 'Trading Agent 1',
            avatar: '🤖',
            color: 'from-blue-500 to-purple-600',
            status: 'Active',
            transactions: 142,
            reputation: 87,
            description: 'Specialized in high-frequency crypto trading with risk management algorithms.',
            createdAt: '2025-01-15T08:30:00'
        },
        {
            id: 2,
            name: 'Trading Agent 2',
            avatar: '🤖',
            color: 'from-emerald-500 to-teal-600',
            status: 'Active',
            transactions: 89,
            reputation: 57,
            description: 'Long-term investment strategist focusing on sustainable DeFi protocols.',
            createdAt: '2025-02-01T14:45:00'
        }
    ]);

    const [searchQuery, setSearchQuery] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const filteredAgents = agents.filter(agent =>
        agent.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
            {/* Header */}
            <header className="sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-center">
                        {/* Pill Navigation */}
                        <BottomNavBar
                            items={[
                                { label: "Home", icon: Home },
                                { label: "Dashboard", icon: LayoutDashboard },
                                { label: "Agent Lists", icon: Users },
                                { label: "Analytics", icon: LineChart },
                                { label: "Settings", icon: Settings },
                            ]}
                            defaultIndex={1}
                            stickyBottom={false}
                            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm text-sm mt-6"
                        />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Page Header with Create Button */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                                Agent Lists
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                Manage and monitor your AI agents
                            </p>
                        </div>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200 hover:-translate-y-0.5"
                        >
                            <svg
                                className="w-5 h-5 transition-transform group-hover:rotate-90"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Agent
                        </button>
                    </div>
                </div>


                {/* Agent Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAgents.map((agent) => (
                        <div
                            key={agent.id}
                            className="group bg-white dark:bg-slate-900 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-slate-950/50 border border-slate-200/50 dark:border-slate-800/50 hover:shadow-2xl hover:shadow-slate-300/50 dark:hover:shadow-slate-950 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                        >
                            {/* Agent Card Header with Gradient */}
                            <div className={`h-32 bg-gradient-to-br ${agent.color} relative`}>
                            </div>

                            {/* Agent Card Body */}
                            <div className="px-4 pb-4">
                                <div className="relative flex justify-between items-start -mt-12 mb-3">
                                    {/* Profile Image - Overlapping */}
                                    <div className="bg-white dark:bg-slate-900 p-1 rounded-full">
                                        <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-4xl border-4 border-white dark:border-slate-900">
                                            {agent.avatar}
                                        </div>
                                    </div>

                                    {/* Manage Button */}
                                    <button className="mt-14 py-1.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-slate-900 font-bold rounded-full transition-colors text-sm">
                                        Manage
                                    </button>
                                </div>

                                {/* Profile Info */}
                                <div>
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                            {agent.name}
                                        </h3>
                                        {agent.status === 'Active' && (
                                            <svg className="w-5 h-5 text-blue-500 fill-current" viewBox="0 0 24 24">
                                                <g><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .495.083.965.238 1.4-1.272.65-2.147 2.02-2.147 3.6 0 1.435.716 2.69 1.792 3.45-.143.46-.22.952-.22 1.464 0 2.697 2.25 4.89 5.027 4.89.28 0 .553-.024.818-.07.72 1.004 1.83 1.66 3.084 1.66s2.365-.658 3.085-1.66c.265.046.54.07.818.07 2.777 0 5.027-2.193 5.027-4.89 0-.512-.077-1.004-.22-1.464 1.076-.76 1.79-2.015 1.79-3.45zm-9.743 4.904l-4.113-3.882 1.34-1.42 2.678 2.527 5.76-6.44 1.432 1.28-7.097 7.935z"></path></g>
                                            </svg>
                                        )}
                                    </div>
                                    <div className="text-slate-500 dark:text-slate-400 text-sm mb-3">
                                        @{agent.name.toLowerCase().replace(/\s+/g, '')}
                                    </div>

                                    <p className="text-slate-900 dark:text-slate-200 mb-2 text-sm leading-snug">
                                        {agent.description}
                                    </p>

                                    <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-3 flex-wrap">
                                        <div className="flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            Created {new Date(agent.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(agent.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>

                                    <div className="flex gap-4 text-sm">
                                        <div className="group cursor-pointer">
                                            <span className="font-bold text-slate-900 dark:text-white group-hover:underline">{agent.reputation}%</span>
                                            <span className="text-slate-500 dark:text-slate-400 ml-1">Reputation</span>
                                        </div>
                                        <div className="group cursor-pointer">
                                            <span className="font-bold text-slate-900 dark:text-white group-hover:underline">{agent.transactions.toLocaleString()}</span>
                                            <span className="text-slate-500 dark:text-slate-400 ml-1">Transactions</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {filteredAgents.length === 0 && (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">🤖</div>
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                            No agents found
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            Try adjusting your search query
                        </p>
                    </div>
                )}
            </main>

            {/* Create Agent Modal */}
            {isCreating && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                                Create New Agent
                            </h3>
                            <button
                                onClick={() => setIsCreating(false)}
                                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Agent Name
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter agent name..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Agent Type
                                </label>
                                <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-slate-900 dark:text-white">
                                    <option>Trading Assistant</option>
                                    <option>Analytics Agent</option>
                                    <option>Security Monitor</option>
                                    <option>Custom</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setIsCreating(false)}
                                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all">
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
