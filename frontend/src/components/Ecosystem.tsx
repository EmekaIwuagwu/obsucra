import React from 'react';
import { motion } from 'framer-motion';

const Ecosystem: React.FC = () => {
    const partners = [
        { name: "Ethereum", category: "L1 Chain", color: "#627EEA" },
        { name: "Arbitrum", category: "L2 Rollup", color: "#2D374B" },
        { name: "Optimism", category: "L2 Rollup", color: "#FF0420" },
        { name: "Solana", category: "L1 Chain", color: "#14F195" },
        { name: "Polygon", category: "Sidechain", color: "#8247E5" },
        { name: "Aave", category: "DeFi Protocol", color: "#B6509E" },
        { name: "Uniswap", category: "DEX", color: "#FF007A" },
        { name: "Curve", category: "Liquidity", color: "#FF0000" },
        { name: "GMX", category: "Derivatives", color: "#303F9F" },
        { name: "Lido", category: "Staking", color: "#00A3FF" },
        { name: "Compound", category: "Lending", color: "#00D395" },
        { name: "MakerDAO", category: "Stablecoin", color: "#1AAB9B" },
    ];

    return (
        <div className="p-8 pt-12 min-h-screen">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-7xl mx-auto"
            >
                <div className="text-center mb-16">
                    <h2 className="text-5xl font-black mb-6 text-white">
                        Trusted Ecosystem
                    </h2>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                        Obscura secures over $4.2 Billion in value across the world's leading blockchain networks and applications.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {partners.map((p, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ scale: 1.05, borderColor: '#00FFFF' }}
                            className="card-glass aspect-square flex flex-col items-center justify-center gap-4 group cursor-pointer"
                        >
                            <div
                                className="w-16 h-16 rounded-full flex items-center justify-center transition-colors shadow-lg"
                                style={{ backgroundColor: `${p.color}20`, boxShadow: `0 0 10px ${p.color}40` }}
                            >
                                {/* Placeholder for Logo */}
                                <span className="text-2xl font-bold" style={{ color: p.color }}>
                                    {p.name[0]}
                                </span>
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-white mb-1">{p.name}</div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider">{p.category}</div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Integration Section */}
                <div className="mt-24 card-glass p-12 text-center">
                    <h3 className="text-3xl font-bold text-white mb-6">Join the Network</h3>
                    <p className="text-gray-400 max-w-2xl mx-auto mb-8">
                        Whether you're a dApp builder, data provider, or node operator, Obscura offers the infrastructure you need to scale.
                    </p>
                    <div className="flex justify-center gap-6">
                        <button
                            onClick={() => alert('Opening Partner Application Form...')}
                            className="px-8 py-4 border border-white/20 rounded-full text-white hover:bg-white/10 font-bold transition-all"
                        >
                            Become a Partner
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Ecosystem;
