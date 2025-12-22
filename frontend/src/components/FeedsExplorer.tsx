import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Feed {
    id: string;
    pair: string;
    value: string;
    confidence: number;
    updated: string;
    isZk: boolean;
}

const mockFeeds: Feed[] = [
    { id: '1', pair: 'BTC/USD', value: '$98,450.22', confidence: 99.9, updated: '2s ago', isZk: true },
    { id: '2', pair: 'ETH/USD', value: '$3,892.15', confidence: 99.5, updated: '5s ago', isZk: true },
    { id: '3', pair: 'SOL/USD', value: '$145.80', confidence: 98.2, updated: '12s ago', isZk: false },
    { id: '4', pair: 'LINK/USD', value: '$22.45', confidence: 99.1, updated: '1s ago', isZk: true },
];

const FeedsExplorer: React.FC = () => {
    const [obscuraMode, setObscuraMode] = useState(false);

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-10">
                <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                    Data Feeds Explorer
                </h2>

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
                            className="card-glass relative overflow-hidden group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-2xl font-bold text-white group-hover:text-[#00FFFF] transition-colors">
                                    {feed.pair}
                                </h3>
                                {feed.isZk && (
                                    <span className="bg-purple-900/50 border border-purple-500 text-purple-200 text-xs px-2 py-1 rounded">
                                        ZK-VERIFIED
                                    </span>
                                )}
                            </div>

                            <div className="relative">
                                {/* Value Display - Obscured if mode is on */}
                                <motion.div
                                    animate={{
                                        filter: obscuraMode ? "blur(8px)" : "blur(0px)",
                                        opacity: obscuraMode ? 0.5 : 1
                                    }}
                                    className="text-4xl font-mono text-white mb-2"
                                >
                                    {feed.value}
                                </motion.div>

                                {obscuraMode && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="absolute inset-0 flex items-center justify-center text-[#00FFFF] font-mono text-sm"
                                    >
                                        [CONFIDENTIAL]
                                    </motion.div>
                                )}
                            </div>

                            <div className="flex justify-between items-end mt-4 text-xs text-gray-400">
                                <div>Confidence: <span className="text-green-400">{feed.confidence}%</span></div>
                                <div>Updated: {feed.updated}</div>
                            </div>

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
