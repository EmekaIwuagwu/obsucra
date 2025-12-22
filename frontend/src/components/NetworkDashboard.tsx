import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Radio, Cpu, Lock, ChevronRight } from 'lucide-react';

const NetworkDashboard: React.FC = () => {
    // Mock Data for "Reports from different blockchains"
    const [chainStats, setChainStats] = useState([
        { id: 'eth', name: 'Ethereum', tps: '15.2', height: '18,543,021', status: 'Optimal' },
        { id: 'sol', name: 'Solana', tps: '2,450', height: '245,678,901', status: 'Optimal' },
        { id: 'arb', name: 'Arbitrum', tps: '45.8', height: '98,123,456', status: 'Optimal' },
        { id: 'opt', name: 'Optimism', tps: '32.1', height: '87,654,321', status: 'Congested' },
    ]);

    const [recentJobs] = useState([
        { id: 'job-1234', type: 'Price Feed', target: 'ETH/USD', status: 'Fulfilled', hash: '0xabc...123' },
        { id: 'job-1235', type: 'VRF Request', target: 'GameFi Contract', status: 'Pending', hash: '0xdef...456' },
        { id: 'job-1236', type: 'ZK Proof', target: 'Private Identity', status: 'Verifying', hash: '0x789...xyz' },
    ]);

    // Simulate live updates
    useEffect(() => {
        const interval = setInterval(() => {
            // Randomly update TPS
            setChainStats(prev => prev.map(chain => ({
                ...chain,
                tps: (parseFloat(chain.tps) + (Math.random() - 0.5)).toFixed(1)
            })));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-8 pt-12 min-h-screen">
            <div className="flex justify-between items-end mb-10">
                <div>
                    <h2 className="text-4xl font-bold text-white mb-2">Network Dashboard</h2>
                    <p className="text-gray-400">Real-time telemetry across supported blockchains.</p>
                </div>
                <div className="flex gap-2">
                    <span className="flex items-center gap-2 text-xs font-mono text-[#00FFFF] bg-[#00FFFF]/10 px-3 py-1 rounded-full border border-[#00FFFF]/30">
                        <div className="w-2 h-2 bg-[#00FFFF] rounded-full animate-pulse" />
                        SYSTEM ONLINE
                    </span>
                </div>
            </div>

            {/* Blockchains Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {chainStats.map((chain) => (
                    <motion.div
                        key={chain.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card-glass relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Activity size={48} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
                            {chain.name}
                            {chain.status === 'Congested' && <span className="w-2 h-2 bg-yellow-500 rounded-full" />}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">TPS</div>
                                <div className="text-2xl font-mono text-[#00FFFF]">{chain.tps}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Block Height</div>
                                <div className="text-sm font-mono text-white">{chain.height}</div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity Feed */}
                <div className="lg:col-span-2 card-glass">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Radio size={20} className="text-[#FF00FF]" />
                        Recent Oracle Requests
                    </h3>

                    <div className="space-y-4">
                        {recentJobs.map((job) => (
                            <div key={job.id} className="flex justify-between items-center bg-white/5 p-4 rounded-lg hover:bg-white/10 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${job.type === 'Price Feed' ? 'bg-blue-500/20 text-blue-400' : job.type === 'VRF Request' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                                        {job.type === 'Price Feed' ? <Activity size={16} /> : job.type === 'VRF Request' ? <Cpu size={16} /> : <Lock size={16} />}
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">{job.type}</div>
                                        <div className="text-xs text-gray-400">{job.target}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <div className="text-right hidden sm:block">
                                        <div className={`text-xs font-bold ${job.status === 'Fulfilled' ? 'text-green-400' : 'text-yellow-400'}`}>
                                            {job.status}
                                        </div>
                                        <div className="text-xs font-mono text-gray-500">{job.hash}</div>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <button className="w-full mt-6 py-3 border border-white/10 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                        View All Activity
                    </button>
                </div>

                {/* System Health / Alerts */}
                <div className="space-y-6">
                    <div className="card-glass bg-gradient-to-br from-[#000033] to-[#4B0082]/50 border-none">
                        <h3 className="text-lg font-bold text-white mb-4">Node Health</h3>
                        <div className="flex justify-center relative w-40 h-40 mx-auto mb-6">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="80" cy="80" r="70" stroke="#333" strokeWidth="10" fill="transparent" />
                                <circle cx="80" cy="80" r="70" stroke="#00FF00" strokeWidth="10" fill="transparent" strokeDasharray="440" strokeDashoffset="20" strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold text-white">98%</span>
                                <span className="text-xs text-green-400">OPTIMAL</span>
                            </div>
                        </div>
                        <div className="space-y-2 text-sm text-gray-300">
                            <div className="flex justify-between">
                                <span>CPU Usage</span>
                                <span className="text-white">34%</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Memory</span>
                                <span className="text-white">12.4 GB</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Latency</span>
                                <span className="text-[#00FFFF]">14ms</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NetworkDashboard;
