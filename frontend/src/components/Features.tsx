
import { motion } from 'framer-motion';
import { Shield, Brain, Globe, Cpu, Lock, Zap } from 'lucide-react';

const Features = () => {
    const features = [
        {
            icon: Shield,
            title: "ZK-Powered Privacy",
            desc: "Obscura Mode utilizes Zero-Knowledge Proofs to aggregate sensitive data without revealing the source inputs.",
            color: "text-purple-400"
        },
        {
            icon: Brain,
            title: "AI Predictive Oracles",
            desc: "Integrated ML models forecast price movements and outliers before they happen on-chain.",
            color: "text-cyan-400"
        },
        {
            icon: Globe,
            title: "Universal Cross-Link",
            desc: "Trustless bridge architecture allowing data to flow seamlessly between Ethereum, Solana, and L2s.",
            color: "text-green-400"
        },
        {
            icon: Lock,
            title: "StakeGuard Security",
            desc: "Multi-tier staking mechanism with instant slashing for malicious nodes to ensure integrity.",
            color: "text-yellow-400"
        },
        {
            icon: Cpu,
            title: "WASM Compute",
            desc: "Off-chain computation for complex logic, verified on-chain via succinct proofs.",
            color: "text-pink-400"
        },
        {
            icon: Zap,
            title: "Millisecond Latency",
            desc: "Optimized P2P mesh network ensures data is delivered faster than any standard oracle.",
            color: "text-orange-400"
        }
    ];

    return (
        <div className="py-24 relative z-10 bg-black/40 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
                        Beyond Standard Oracles
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Obscura isn't just a data feed. It's an intelligent, private, and cross-chain nervous system for Web3.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((f, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="card-glass group hover:bg-white/10"
                        >
                            <f.icon className={`w-12 h-12 ${f.color} mb-4 group-hover:scale-110 transition-transform`} />
                            <h3 className="text-2xl font-bold text-white mb-2">{f.title}</h3>
                            <p className="text-gray-400 leading-relaxed">{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Features;
