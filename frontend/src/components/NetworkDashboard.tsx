import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Radio, Cpu, Lock, ChevronRight, BarChart3, Coins, Zap } from 'lucide-react';
import { ObscuraSDK } from '../sdk/obscura';

const NetworkDashboard: React.FC = () => {
    // Chain stats fetched from backend
    const [chainStats, setChainStats] = useState<any[]>([]);
    const [recentJobs, setRecentJobs] = useState<any[]>([]);
    const [nodeMetrics, setNodeMetrics] = useState<any>(null);
    const [networkInfo, setNetworkInfo] = useState<any>(null);
    const sdk = new ObscuraSDK();

    // Fetch real data from backend
    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const stats = await sdk.getNetworkStats();
                setNodeMetrics(stats);
            } catch (err) {
                console.error("Failed to fetch node metrics:", err);
            }
        };

        const fetchRecentJobs = async () => {
            try {
                const jobs = await sdk.getRecentJobs();
                setRecentJobs(jobs);
            } catch (err) {
                console.error("Failed to fetch jobs:", err);
            }
        };

        const fetchChainStats = async () => {
            try {
                const chains = await sdk.getChainStats();
                setChainStats(chains);
            } catch (err) {
                console.error("Failed to fetch chain stats:", err);
            }
        };

        const fetchNetworkInfo = async () => {
            try {
                const info = await sdk.getNetworkInfo();
                setNetworkInfo(info);
            } catch (err) {
                console.error("Failed to fetch network info:", err);
            }
        };

        fetchMetrics();
        fetchRecentJobs();
        fetchChainStats();
        fetchNetworkInfo();

        const interval = setInterval(() => {
            fetchMetrics();
            fetchRecentJobs();
            fetchChainStats();
            fetchNetworkInfo();
        }, 5000);
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
                                    <span className="text-gray-400">Security Guard</span>
                                    <span className="text-green-400 font-bold">{networkInfo?.security_status || 'ACTIVE'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">OEV Potential</span>
                                    <span className="text-cyan-400 font-bold tracking-widest">{networkInfo?.oev_potential || 'HIGH'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* OEV RECAPTURE CARD */}
                    <div className="card-glass bg-gradient-to-br from-[#001212] to-[#004D4D]/20 border-cyan-500/20 shadow-[0_0_30px_rgba(0,255,255,0.05)]">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Coins size={20} className="text-yellow-400" />
                                OEV Recaptured
                            </h3>
                            <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                                PHASE 2 ACTIVE
                            </span>
                        </div>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-4 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
                                <Zap size={32} className="text-cyan-400" />
                            </div>
                            <div>
                                <div className="text-4xl font-mono text-white font-bold">
                                    {(networkInfo?.oev_recaptured_eth || (nodeMetrics?.oev_recaptured || 0) * 0.0001).toFixed(4)} <span className="text-sm text-gray-500">ETH</span>
                                </div>
                                <div className="text-xs text-cyan-400 font-bold tracking-widest uppercase">Protocol Revenue Shared</div>
                            </div>
                        </div>

                        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                            <div className="flex justify-between text-xs mb-2">
                                <span className="text-gray-400">Last Auction Winner</span>
                                <span className="text-white font-mono text-[10px]">{networkInfo?.last_auction_winner || '0x71C...4f9b'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-400">Auction Frequency</span>
                                <span className="text-white font-mono text-[10px]">{networkInfo?.auction_frequency_ms ? `${(networkInfo.auction_frequency_ms / 60000).toFixed(1)}m avg` : '1.2m avg'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NetworkDashboard;
