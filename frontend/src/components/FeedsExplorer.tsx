import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ObscuraSDK } from '../sdk/obscura';

interface Feed {
    id: string;
    pair: string;
    value: string;
    confidence: number;
    updated: string;
    isZk: boolean;
    isOptimistic?: boolean;
    challengeDeadline?: number; // timestamp
    roundId: number;
    timestamp: string;
}


import { ShieldCheck, Zap, Timer, AlertCircle } from 'lucide-react';

const FeedsExplorer: React.FC = () => {
    const [obscuraMode, setObscuraMode] = useState(false);
    const [feeds, setFeeds] = useState<Feed[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const sdk = new ObscuraSDK();
        const fetchFeeds = async () => {
            try {
                const data = await sdk.getFeeds();
                if (data && data.length > 0) {
                    setFeeds(data.map((f: any) => ({
                        id: f.id,
                        pair: f.id,
                        value: f.value,
                        confidence: f.confidence,
                        updated: 'Just now',
                        isZk: f.is_zk,
                        isOptimistic: f.is_optimistic,
                        roundId: f.round_id,
                        timestamp: new Date(f.timestamp).toLocaleString(),
                        confidenceInterval: f.confidence_interval
                    })));
                } else {
                    setFeeds([]);
                }
            } catch (err) {
                console.error("Failed to fetch feeds:", err);
                setFeeds([]);
            } finally {
                setLoading(false);
            }
        };

        fetchFeeds();
        const interval = setInterval(fetchFeeds, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
                        Data Feeds Explorer
                    </h2>
                    <p className="text-gray-400">Verifying latest persistence rounds from Obscura Mainnet.</p>
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
                        <div className="w-12 h-12 border-4 border-[#00FFFF]/20 border-t-[#00FFFF] rounded-full animate-spin" />
                    </div>
                )}
                <AnimatePresence>
                    {!loading && feeds.map((feed) => (
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
                                    className="text-4xl font-mono text-white mb-1"
                                >
                                    {feed.value}
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
                                        <span className="text-green-400 font-bold">{feed.confidence}%</span>
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
                    {!loading && feeds.length === 0 && (
                        <div className="col-span-full text-center py-20 text-gray-500 uppercase tracking-widest text-sm">
                            No Active Data Feeds Found
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default FeedsExplorer;
