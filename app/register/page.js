'use client';

import { useState } from 'react';

export default function Register() {
    const [agents, setAgents] = useState([
        {
            id: 1,
            name: 'Trading Agent 1',
            avatar: '🤖',
            color: 'from-blue-500 to-purple-600',
            status: 'Active',
            transactions: 142,
            reputation: 87
        },
        {
            id: 2,
            name: 'Trading Agent 2',
            avatar: '🤖',
            color: 'from-emerald-500 to-teal-600',
            status: 'Active',
            transactions: 89,
            reputation: 57
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
            <header className="border-b border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-center h-16">
                        {/* Pill Navigation */}
                        <nav className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-full">
                            <a href="#" className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-full transition-all">
                                Dashboard
                            </a>
                            <a href="#" className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-full shadow-md transition-all">
                                Agent Lists
                            </a>
                            <a href="#" className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-full transition-all">
                                Analytics
                            </a>
                            <a href="#" className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-full transition-all">
                                Settings
                            </a>
                        </nav>
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
                            <div className={`h-32 bg-gradient-to-br ${agent.color} relative overflow-hidden`}>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                                    <div className="text-6xl filter drop-shadow-lg">
                                        {agent.avatar}
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${agent.status === 'Active'
                                        ? 'bg-green-500/90 text-white'
                                        : 'bg-slate-500/90 text-white'
                                        } backdrop-blur-sm`}>
                                        {agent.status}
                                    </div>
                                </div>
                            </div>

                            {/* Agent Card Body */}
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {agent.name}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    Last active: 2 hours ago
                                </p>

                                {/* Agent Stats */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Transaction</div>
                                        <div className="text-xl font-bold text-slate-900 dark:text-white">{agent.transactions}</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Reputation</div>
                                        <div className={`text-xl font-bold ${agent.reputation >= 70 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                                            }`}>
                                            {agent.reputation}%
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                    <button className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-blue-500/30">
                                        Manage
                                    </button>
                                    <button className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                        </svg>
                                    </button>
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
