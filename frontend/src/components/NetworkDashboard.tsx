import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Radio, Cpu, Lock, ChevronRight, BarChart3 } from 'lucide-react';
import { ObscuraSDK } from '../sdk/obscura';

const NetworkDashboard: React.FC = () => {
    // Mock Data for "Reports from different blockchains"
    const [chainStats, setChainStats] = useState([
        { id: 'eth', name: 'Ethereum', tps: '15.2', height: '18,543,021', status: 'Optimal' },
        { id: 'sol', name: 'Solana', tps: '2,450', height: '245,678,901', status: 'Optimal' },
        { id: 'arb', name: 'Arbitrum', tps: '45.8', height: '98,123,456', status: 'Optimal' },
        { id: 'opt', name: 'Optimism', tps: '32.1', height: '87,654,321', status: 'Congested' },
    ]);

    const [recentJobs] = useState([
        { id: 'job-1234', type: 'Price Feed', target: 'ETH/USD', status: 'Fulfilled', hash: '0xabc...123', roundId: 1042 },
        { id: 'job-1235', type: 'VRF Request', target: 'GameFi Contract', status: 'Pending', hash: '0xdef...456', roundId: 8521 },
        { id: 'job-1236', type: 'ZK Proof', target: 'Private Identity', status: 'Verifying', hash: '0x789...xyz', roundId: 442 },
    ]);

    const [nodeMetrics, setNodeMetrics] = useState<any>(null);
    const sdk = new ObscuraSDK();

    // Simulate live updates & Fetch real metrics
    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const stats = await sdk.getNetworkStats();
                setNodeMetrics(stats);
            } catch (err) {
                console.error("Failed to fetch node metrics:", err);
            }
        };

        fetchMetrics();
        const interval = setInterval(() => {
            fetchMetrics();
            // Randomly update TPS (still mock for now)
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
                                            {job.status} {job.roundId && <span className="text-gray-500 ml-1">#R{job.roundId}</span>}
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

                {/* System Health / Live Telemetry */}
                <div className="space-y-6">
                    <div className="card-glass bg-gradient-to-br from-[#000033] to-[#4B0082]/50 border-none">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <BarChart3 size={20} className="text-[#00FFFF]" />
                            Live Telemetry
                        </h3>

                        <div className="space-y-6">
                            <div className="flex justify-between items-end border-b border-white/5 pb-4">
                                <div>
                                    <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Requests Processed</div>
                                    <div className="text-3xl font-mono text-white">{nodeMetrics?.requests_processed || '0'}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Proofs Generated</div>
                                    <div className="text-xl font-mono text-[#00FFFF]">{nodeMetrics?.proofs_generated || '0'}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                    <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">TX Sent</div>
                                    <div className="text-xl font-mono text-green-400 font-bold">{nodeMetrics?.transactions_sent || '0'}</div>
                                </div>
                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                    <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Aggregations</div>
                                    <div className="text-xl font-mono text-purple-400 font-bold">{nodeMetrics?.aggregations_completed || '0'}</div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Node Uptime</span>
                                    <span className="text-white font-mono">{nodeMetrics ? Math.floor(nodeMetrics.uptime_seconds / 60) : 0}m {nodeMetrics ? Math.floor(nodeMetrics.uptime_seconds % 60) : 0}s</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Verification Engine</span>
                                    <span className="text-green-400 font-bold">ACTIVE</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Outliers Dropped</span>
                                    <span className="text-red-400 font-mono">{nodeMetrics?.outliers_detected || '0'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NetworkDashboard;
