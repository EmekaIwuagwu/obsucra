import React from 'react';
import { motion } from 'framer-motion';

const StakingInterface: React.FC = () => {
    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-12 text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 text-glow-gold">
                Liquid Staking Pools
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Visual Orb */}
                <div className="flex items-center justify-center relative h-96">
                    <motion.div
                        animate={{
                            rotate: 360,
                            boxShadow: [
                                "0 0 50px rgba(255, 215, 0, 0.2)",
                                "0 0 100px rgba(255, 215, 0, 0.5)",
                                "0 0 50px rgba(255, 215, 0, 0.2)"
                            ]
                        }}
                        transition={{
                            rotate: { duration: 20, ease: "linear", repeat: Infinity },
                            boxShadow: { duration: 2, repeat: Infinity }
                        }}
                        className="w-64 h-64 rounded-full bg-gradient-to-br from-[#1a1a40] to-[#000] border-4 border-[#FFD700] flex items-center justify-center relative z-10"
                    >
                        <div className="text-center">
                            <div className="text-xs text-[#FFD700] uppercase tracking-widest mb-1">Total Staked</div>
                            <div className="text-4xl font-mono text-white">42.8M</div>
                            <div className="text-sm text-gray-400">OBS</div>
                        </div>
                    </motion.div>

                    {/* Orbiting particles */}
                    <div className="absolute inset-0 animate-orbit opacity-50">
                        <div className="w-4 h-4 bg-[#00FFFF] rounded-full absolute top-1/2 left-0 box-shadow-neon" />
                    </div>
                </div>

                {/* Staking Controls */}
                <div className="space-y-6">
                    <div className="card-glass p-8">
                        <h3 className="text-2xl font-bold text-white mb-6">Stake OBS</h3>

                        <div className="mb-6">
                            <div className="flex justify-between text-sm text-gray-400 mb-2">
                                <span>Amount</span>
                                <span>Balance: 5,430.00 OBS</span>
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    className="w-full bg-black/40 border border-gray-600 rounded-lg p-4 text-2xl text-white focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none"
                                />
                                <button className="absolute right-4 top-1/2 -translate-y-1/2 text-[#FFD700] text-sm font-bold hover:text-white">
                                    MAX
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">APY</span>
                                <span className="text-[#00FF00] font-bold">14.5%</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Lock Period</span>
                                <span className="text-white">30 Days</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Reward Rate</span>
                                <span className="text-white">0.04 OBS / Hour</span>
                            </div>
                        </div>

                        <button className="w-full btn-cosmic bg-gradient-to-r from-[#FFD700] to-[#FF4500] shadow-[0_0_15px_#FFD700]">
                            Confirm Stake
                        </button>
                    </div>

                    <div className="card-glass p-6 flex justify-between items-center">
                        <div>
                            <div className="text-sm text-gray-400">Unclaimed Rewards</div>
                            <div className="text-xl font-bold text-white">124.50 OBS</div>
                        </div>
                        <button className="px-6 py-2 border border-[#00FFFF] text-[#00FFFF] rounded-lg hover:bg-[#00FFFF]/10 transition-colors">
                            Claim
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StakingInterface;
