import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Feed {
    id: string;
    pair: string;
    value: string;
    confidence: number;
    updated: string;
    isZk: boolean;
    roundId: number;
    timestamp: string;
}

const mockFeeds: Feed[] = [
    { id: '1', pair: 'BTC/USD', value: '$98,450.22', confidence: 99.9, updated: '2s ago', isZk: true, roundId: 1042, timestamp: "2025-12-23 08:30:12" },
    { id: '2', pair: 'ETH/USD', value: '$3,892.15', confidence: 99.5, updated: '5s ago', isZk: true, roundId: 8521, timestamp: "2025-12-23 08:31:05" },
    { id: '3', pair: 'SOL/USD', value: '$145.80', confidence: 98.2, updated: '12s ago', isZk: false, roundId: 442, timestamp: "2025-12-23 08:29:45" },
    { id: '4', pair: 'LINK/USD', value: '$22.45', confidence: 99.1, updated: '1s ago', isZk: true, roundId: 120, timestamp: "2025-12-23 08:31:22" },
];

const FeedsExplorer: React.FC = () => {
    const [obscuraMode, setObscuraMode] = useState(false);

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
                <AnimatePresence>
                    {mockFeeds.map((feed) => (
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
                                        <span className="bg-cyan-900/40 border border-cyan-500/50 text-cyan-200 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                            ZK-VERIFIED
                                        </span>
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
                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Consensus Reached</span>
                                </div>
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
                </AnimatePresence>
            </div>
        </div>
    );
};

export default FeedsExplorer;
