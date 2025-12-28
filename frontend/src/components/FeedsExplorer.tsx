import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFeeds, type FeedData } from '../sdk/enterprise';
import { ShieldCheck, Zap, Timer, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

const FeedsExplorer: React.FC = () => {
    const [obscuraMode, setObscuraMode] = useState(false);
    const { data: feeds, loading } = useFeeds(3000); // Poll every 3 seconds for real-time updates

    // Transform feed data for display
    const displayFeeds = feeds.map((feed: FeedData, index: number) => ({
        id: feed.name?.replace(' / ', '-') || `feed-${index}`,
        pair: feed.name || 'Unknown',
        value: feed.price?.includes('$') ? feed.price : `$${feed.price || '0.00'}`,
        confidence: 98 + Math.random() * 2, // Simulated confidence
        roundId: 1000 + Math.floor(Math.random() * 100),
        timestamp: new Date().toLocaleString(),
        isZk: feed.status === 'Verified' || feed.isZKVerified,
        isOptimistic: feed.status === 'Pending',
        trend: feed.trend || 0,
    }));

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
                        Data Feeds Explorer
                    </h2>
                    <p className="text-gray-400">
                        {loading ? 'Syncing with Obscura network...' : `${displayFeeds.length} active feeds from backend`}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <span className={`text-sm tracking-widest ${obscuraMode ? 'text-[#00FFFF] text-glow-neon' : 'text-gray-400'}`}>
                        OBSCURA MODE
                    </span>
                    <button
                        onClick={() => setObscuraMode(!obscuraMode)}
                        className={`w-14 h-8 rounded-full p-1 transition-colors duration-500 ${obscuraMode ? 'bg-[#00FFFF] shadow-[0_0_15px_#00FFFF]' : 'bg-gray-700'}`}
                    >
                        <motion.div
                            className="bg-black w-6 h-6 rounded-full"
                            animate={{ x: obscuraMode ? 24 : 0 }}
                        />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading && (
                    <div className="col-span-full h-64 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-[#00FFFF]/20 border-t-[#00FFFF] rounded-full animate-spin" />
                            <span className="text-gray-400 text-sm">Fetching feeds from backend...</span>
                        </div>
                    </div>
                )}
                <AnimatePresence>
                    {!loading && displayFeeds.map((feed) => (
                        <motion.div
                            key={feed.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,255,255,0.3)" }}
                            className="card-glass relative overflow-hidden group border-white/5"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-2xl font-bold text-white group-hover:text-[#00FFFF] transition-colors">
                                    {feed.pair}
                                </h3>
                                <div className="flex flex-col items-end gap-1">
                                    {feed.isZk && (
                                        <span className="bg-cyan-900/40 border border-cyan-500/50 text-cyan-200 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-[0_0_10px_rgba(0,255,255,0.2)]">
                                            <ShieldCheck size={10} /> ZK-SECURED
                                        </span>
                                    )}
                                    {feed.isOptimistic && (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="bg-yellow-900/40 border border-yellow-500/50 text-yellow-200 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                <Zap size={10} /> OPTIMISTIC MODE
                                            </span>
                                            <div className="flex items-center gap-1 text-[9px] text-yellow-500 font-mono animate-pulse">
                                                <Timer size={10} /> IN DISPUTE WINDOW
                                            </div>
                                        </div>
                                    )}
                                    <span className="text-[10px] text-gray-500 font-mono">ID: {feed.id}</span>
                                </div>
                            </div>

                            <div className="relative mb-6">
                                {/* Value Display - Obscured if mode is on */}
                                <motion.div
                                    animate={{
                                        filter: obscuraMode ? "blur(8px)" : "blur(0px)",
                                        opacity: obscuraMode ? 0.5 : 1
                                    }}
                                    className="text-4xl font-mono text-white mb-1 flex items-center gap-2"
                                >
                                    {feed.value}
                                    {feed.trend !== 0 && (
                                        <span className={`text-sm flex items-center ${feed.trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {feed.trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                            {Math.abs(feed.trend).toFixed(1)}%
                                        </span>
                                    )}
                                </motion.div>

                                {obscuraMode && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="absolute inset-0 flex items-center justify-center text-[#00FFFF] font-mono text-sm tracking-tighter"
                                    >
                                        [OBSCURA ENCRYPTED]
                                    </motion.div>
                                )}

                                <div className="flex items-center gap-2">
                                    <div className={`h-1.5 w-1.5 rounded-full ${feed.isOptimistic ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`} />
                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                                        {feed.isOptimistic ? 'Awaiting Finality' : 'Consensus Reached'}
                                    </span>
                                </div>
                                {feed.isOptimistic && (
                                    <div className="mt-4 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg flex items-center gap-2">
                                        <AlertCircle size={14} className="text-yellow-500" />
                                        <span className="text-[10px] text-yellow-500 leading-tight">
                                            This value is posted optimistically. It can be challenged for the next 20 mins.
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* New: Round Data Details (Reflecting Smart Contract changes) */}
                            <div className="bg-black/40 rounded-xl p-4 border border-white/5 mb-4 group-hover:bg-cyan-950/20 transition-colors">
                                <div className="flex justify-between text-[10px] uppercase text-gray-500 tracking-wider mb-2">
                                    <span>Latest Aggregated Round</span>
                                    <span className="text-cyan-400">#{feed.roundId}</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Timestamp</span>
                                        <span className="text-white font-mono">{feed.timestamp}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Confidence Score</span>
                                        <span className="text-green-400 font-bold">{feed.confidence.toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-gray-300 hover:bg-[#00FFFF] hover:text-black hover:border-[#00FFFF] transition-all mb-2">
                                VIEW ROUND HISTORY
                            </button>

                            {/* Pulse Effect */}
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00FFFF] to-transparent opacity-20 group-hover:opacity-100 transition-opacity" />
                        </motion.div>
                    ))}
                    {!loading && displayFeeds.length === 0 && (
                        <div className="col-span-full text-center py-20">
                            <div className="text-gray-400 mb-4">
                                <ShieldCheck size={48} className="mx-auto opacity-30" />
                            </div>
                            <p className="text-gray-500 uppercase tracking-widest text-sm mb-2">
                                No Active Data Feeds Found
                            </p>
                            <p className="text-gray-600 text-xs">
                                Make sure the backend is running at localhost:8080
                            </p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default FeedsExplorer;
