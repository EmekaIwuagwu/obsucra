import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Zap, Lock, RefreshCw, Cpu, Database, X, Book, Code, CheckCircle } from 'lucide-react';

interface ProductDetail {
    id: string;
    title: string;
    icon: any;
    desc: string;
    features: string[];
    techSpecs: {
        language: string;
        components: string[];
        methods: string[];
        events: string[];
        description: string;
    };
}

const Products: React.FC = () => {
    const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);

    const products: ProductDetail[] = [
        {
            id: 'obscura-mode',
            icon: Lock,
            title: "Obscura Mode",
            desc: "The core privacy layer. Allows smart contracts to ingest sensitive off-chain data (credit scores, bank APIs) without revealing the raw inputs on the public ledger.",
            features: ["ZK-SNARKs / STARKs", "TEE Support (SGX/Nitro)", "GDPR Compliance"],
            techSpecs: {
                language: 'Go / Circom',
                components: ['AdapterManager', 'ZKProver', 'OnChainVerifier'],
                methods: ['GenerateProof(inputs)', 'VerifyProof(proof, publicSignals)'],
                events: ['ProofVerified', 'DataAggregated'],
                description: "Utilizes recursive SNARKs to aggregate data off-chain. The Node's AdapterManager fetches private data, generates a zero-knowledge proof using the internal ZK engine, and submits only the proof and result to the chain."
            }
        },
        {
            id: 'autotriggers',
            icon: Zap,
            title: "AutoTriggers",
            desc: "Conditional execution network. Automate liquidations, limit orders, and rebasing mechanisms with millisecond latency.",
            features: ["Event-driven", "Gas Optimized", "Multi-chain"],
            techSpecs: {
                language: 'Solidity / Go',
                components: ['AutoTriggers.sol', 'TriggerManager (Go)'],
                methods: ['registerTrigger(target, payload, interval)', 'checkUpkeep(id)', 'performUpkeep(id)'],
                events: ['TriggerRegistered(id, target)', 'TriggerExecuted(id)'],
                description: "Smart contract registry where users define execution conditions (interval or value-based). The backend 'TriggerManager' monitors 'checkUpkeep' and automatically calls 'performUpkeep' when conditions are met."
            }
        },
        {
            id: 'crosslink',
            icon: Network,
            title: "CrossLink",
            desc: "Trustless interoperability bridge. Move data and tokens between EVM, Solana, and Cosmos chains securely.",
            features: ["Burn-and-Mint", "Arbitrary Message Passing", "Instant Finality"],
            techSpecs: {
                language: 'Solidity',
                components: ['CrossLink.sol', 'RelayerNode'],
                methods: ['sendMessage(targetChain, address, payload)', 'receiveMessage(msgId, source, payload)'],
                events: ['MessageSent(msgId, target)', 'MessageReceived(msgId, source)'],
                description: "Implements a lock-and-mint mechanism with double-spend protection via the 'processedMessages' mapping. Messages are uniquely identified by a keccak256 hash of their timestamp and payload."
            }
        },
        {
            id: 'vrf',
            icon: RefreshCw,
            title: "VRF +",
            desc: "Verifiable Random Function enhanced with quantum-resistant algorithms for gaming and lottery fairness.",
            features: ["Unbiasable", "Low Latency", "On-chain Proof"],
            techSpecs: {
                language: 'Solidity',
                components: ['VRF.sol', 'VRFCoordinator'],
                methods: ['requestRandomness(seed)', 'fulfillRandomness(requestId, randomness)'],
                events: ['RandomnessRequested(requestId, seed)', 'RandomnessFulfilled(requestId, value)'],
                description: "A request-response model where contracts request randomness associated with a seed. The Obscura Node generates a verifiable random number off-chain and fulfills it on-chain via the Coordinator."
            }
        },
        {
            id: 'compute',
            icon: Cpu,
            title: "ComputeFuncs",
            desc: "Serverless WASM functions running on Obscura Nodes. Offload heavy computation from expensive L1s.",
            features: ["Rust/Go/AssemblyScript", "Deterministic", "Storage Proofs"],
            techSpecs: {
                language: 'Go (Wazero)',
                components: ['ComputeManager', 'WASM Runtime'],
                methods: ['ExecuteWasm(ctx, code, funcName, params)', 'compileModule(code)'],
                events: ['ComputationTaskSubmitted', 'ResultPosted'],
                description: "Powered by the 'wazero' runtime for pure Go WASM execution. Allows developers to upload compiled .wasm binaries which are executed deterministically by the node, returning only the result on-chain."
            }
        },
        {
            id: 'instdata',
            icon: Database,
            title: "InstData Suite",
            desc: "Institutional data marketplace. Access premium financial feeds from NYSE, Nasdaq, and Bloomberg authorized providers.",
            features: ["Whitelisted Providers", "High Frequency", "Compliance-ready"],
            techSpecs: {
                language: 'Solidity',
                components: ['InstData.sol', 'AccessControl'],
                methods: ['postData(asset, price)', 'addProvider(address)', 'removeProvider(address)'],
                events: ['DataPosted(asset, price, provider)'],
                description: "A permissioned data feed contract where only 'authorizedProviders' (whitelisted via Governance) can update values. Ensures high-integrity data streams for institutional finance."
            }
        }
    ];

    return (
        <div className="p-8 pt-12 min-h-screen relative">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-7xl mx-auto"
            >
                <div className="text-center mb-16">
                    <h2 className="text-5xl font-black mb-6 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                        Product Suite
                    </h2>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                        A complete ecosystem of decentralized infrastructure tools designed for the next generation of privacy-preserving DeFi.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {products.map((prod, i) => (
                        <motion.div
                            key={i}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="card-glass relative overflow-hidden group flex flex-col"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                                <prod.icon size={100} />
                            </div>

                            <prod.icon className="w-12 h-12 text-[#00FFFF] mb-6 group-hover:scale-110 transition-transform" />
                            <h3 className="text-2xl font-bold text-white mb-3">{prod.title}</h3>
                            <p className="text-gray-400 mb-6 leading-relaxed flex-grow">{prod.desc}</p>

                            <div className="space-y-2 mb-8">
                                {prod.features.map((feat, j) => (
                                    <div key={j} className="flex items-center gap-2 text-sm text-gray-500">
                                        <div className="w-1 h-1 bg-[#FF00FF] rounded-full" />
                                        {feat}
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => setSelectedProduct(prod)}
                                className="mt-auto w-full py-3 border border-white/10 rounded-lg text-white hover:bg-white/5 transition-colors font-medium flex items-center justify-center gap-2"
                            >
                                <Book size={16} /> View Documentation
                            </button>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* Documentation Modal */}
            <AnimatePresence>
                {selectedProduct && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#0A0A2A] border border-white/20 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                        >
                            <div className="p-8 relative">
                                <button
                                    onClick={() => setSelectedProduct(null)}
                                    className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
                                >
                                    <X size={24} />
                                </button>

                                <div className="flex items-center gap-4 mb-6">
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                        <selectedProduct.icon size={32} className="text-[#00FFFF]" />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-white">{selectedProduct.title}</h3>
                                        <span className="text-sm font-mono text-gray-400">Technical Specification v1.0.0</span>
                                    </div>
                                </div>

                                <p className="text-gray-300 text-lg leading-relaxed mb-8 border-b border-white/10 pb-6">
                                    {selectedProduct.techSpecs.description}
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Code size={14} /> Core Components
                                            </h4>
                                            <ul className="space-y-2">
                                                {selectedProduct.techSpecs.components.map((c, i) => (
                                                    <li key={i} className="text-white font-mono text-sm bg-white/5 px-3 py-2 rounded border border-white/5">
                                                        {c}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Methods</h4>
                                            <ul className="space-y-2">
                                                {selectedProduct.techSpecs.methods.map((m, i) => (
                                                    <li key={i} className="text-[#00FFFF] font-mono text-sm">
                                                        {m}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="bg-black/30 rounded-xl p-6 border border-white/5">
                                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Emitted Events</h4>
                                        <div className="space-y-3">
                                            {selectedProduct.techSpecs.events.map((e, i) => (
                                                <div key={i} className="flex items-start gap-3">
                                                    <CheckCircle size={16} className="text-green-500 mt-1 shrink-0" />
                                                    <span className="font-mono text-sm text-gray-300 break-all">{e}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-6 pt-6 border-t border-white/10">
                                            <div className="text-xs text-gray-500 mb-1">Language Stack</div>
                                            <div className="text-white font-bold">{selectedProduct.techSpecs.language}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-end">
                                    <button
                                        onClick={() => setSelectedProduct(null)}
                                        className="px-6 py-3 bg-[#00FFFF] hover:bg-[#00FFFF]/80 text-black font-bold rounded-lg transition-colors"
                                    >
                                        Close Specification
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Products;
