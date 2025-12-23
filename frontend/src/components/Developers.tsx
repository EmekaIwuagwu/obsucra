import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Copy, Check, Code, BookOpen, Layers } from 'lucide-react';

const Developers: React.FC = () => {
    const [copied, setCopied] = useState(false);
    const [activeSection, setActiveSection] = useState<'quickstart' | 'docs' | 'api' | 'examples'>('quickstart');

    const handleCopy = () => {
        navigator.clipboard.writeText('npm install @obscura-network/sdk ethers');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-8 pt-12 min-h-screen">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-6xl mx-auto"
            >
                {/* Header */}
                <div className="mb-16 text-center">
                    <h2 className="text-5xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600">
                        Build the Impossible
                    </h2>
                    <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
                        Access ZK-proven data streams, run confidential compute logic, and automate smart contracts with the Obscura SDK.
                    </p>

                    {/* Navigation for Docs Sections */}
                    <div className="flex justify-center gap-4 mt-8">
                        {['quickstart', 'docs', 'api', 'examples'].map(sec => (
                            <button
                                key={sec}
                                onClick={() => setActiveSection(sec as any)}
                                className={`px-4 py-2 rounded-full border border-white/10 text-sm font-bold uppercase tracking-wider transition-all ${activeSection === sec ? 'bg-[#00FFFF] text-black shadow-[0_0_15px_#00FFFF]' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                {sec}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Switching */}
                {activeSection === 'quickstart' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
                        <div className="card-glass p-8">
                            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                                <Terminal className="text-[#00FFFF]" />
                                Quick Setup
                            </h3>
                            <p className="text-gray-400 mb-6">Install the Obscura SDK to interact with the privacy layer directly from your dApp frontend.</p>

                            <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex justify-between items-center group hover:border-[#00FFFF]/50 transition-colors">
                                <code className="text-gray-300 font-mono text-sm">npm install @obscura-network/sdk ethers</code>
                                <button
                                    onClick={handleCopy}
                                    className="text-gray-500 hover:text-white transition-colors"
                                >
                                    {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                                </button>
                            </div>

                            <div className="mt-8 space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center text-purple-400 font-bold border border-purple-500/30">1</div>
                                    <span className="text-gray-300">Import functionality</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center text-purple-400 font-bold border border-purple-500/30">2</div>
                                    <span className="text-gray-300">Connect Wallet</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-purple-900/50 flex items-center justify-center text-purple-400 font-bold border border-purple-500/30">3</div>
                                    <span className="text-gray-300">Request Data</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#0A0A2A] rounded-xl border border-white/10 p-6 font-mono text-sm overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-full h-8 bg-white/5 flex items-center px-4 gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                            </div>
                            <div className="mt-8 text-gray-300 overflow-x-auto">
                                <pre>{`import { ObscuraClient } from '@obscura-network/sdk';

// Initialize Client
const obscura = new ObscuraClient({
  apiKey: 'OBS_...',
  chain: 'ethereum'
});

// Request ZK-Verified Price
const price = await obscura.feeds.get('ETH/USD', {
  privacy: 'zk-stark',
  tolerance: 0.01 
});

console.log('Verified Price:', price.value);`}</pre>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeSection === 'docs' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-glass p-12 min-h-[400px]">
                        <h3 className="text-3xl font-bold text-white mb-6">Core Documentation</h3>
                        <div className="space-y-6 text-gray-300">
                            <div className="p-4 border border-white/10 rounded-lg hover:bg-white/5 cursor-pointer">
                                <h4 className="font-bold text-[#00FFFF] mb-2">Architecture Overview</h4>
                                <p className="text-sm">Learn how Obscura Nodes communicate via LibP2P and aggregate data using recursive SNARKs.</p>
                            </div>
                            <div className="p-4 border border-white/10 rounded-lg hover:bg-white/5 cursor-pointer">
                                <h4 className="font-bold text-[#00FFFF] mb-2">Smart Contracts</h4>
                                <p className="text-sm">Solidity interfaces for ObscuraOracle.sol, StakeGuard.sol, and VRF.sol.</p>
                            </div>
                            <div className="p-4 border border-white/10 rounded-lg hover:bg-white/5 cursor-pointer">
                                <h4 className="font-bold text-[#00FFFF] mb-2">Security Model</h4>
                                <p className="text-sm">Understanding slashing conditions, reputation scores, and TEE attestation.</p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeSection === 'api' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-glass p-12 min-h-[400px]">
                        <h3 className="text-3xl font-bold text-white mb-6">API Reference (v1.0)</h3>
                        <div className="font-mono text-sm space-y-10">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-green-900 text-green-400 rounded">GET</span>
                                    <span className="text-white">/api/stats</span>
                                </div>
                                <p className="text-gray-400">Returns node telemetry including uptime, proofs generated, and OEV recaptured.</p>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-green-900 text-green-400 rounded">GET</span>
                                    <span className="text-white">/api/feeds</span>
                                </div>
                                <p className="text-gray-400">Returns list of active data feeds with live values, confidence intervals, and ZK status.</p>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-green-900 text-green-400 rounded">GET</span>
                                    <span className="text-white">/api/jobs</span>
                                </div>
                                <p className="text-gray-400">Returns the last 50 processed oracle requests (Price Feeds, VRF, ZK Compute).</p>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-green-900 text-green-400 rounded">GET</span>
                                    <span className="text-white">/api/proposals</span>
                                </div>
                                <p className="text-gray-400">Returns the list of community governance proposals for the DAO.</p>
                            </div>
                            <div className="pt-6 border-t border-white/5">
                                <h4 className="text-gray-300 mb-2 uppercase text-xs font-bold tracking-widest text-cyan-400">Authenticated Sources</h4>
                                <div className="text-xs text-gray-500 leading-relaxed">
                                    Private endpoints require injection from the node's secure vault. Use the Enterprise Gateway UI to manage institutional credentials.
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeSection === 'examples' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-glass p-12 min-h-[400px]">
                        <h3 className="text-3xl font-bold text-white mb-6">Example dApps</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 border border-white/10 rounded-xl hover:border-[#00FFFF] transition-colors group cursor-pointer">
                                <h4 className="text-xl font-bold text-white mb-2 group-hover:text-[#00FFFF]">Prediction Market</h4>
                                <p className="text-gray-400 text-sm mb-4">A decentralized betting platform using Obscura for sports results.</p>
                                <span className="text-xs font-mono text-gray-500">github.com/obscura/examples/market</span>
                            </div>
                            <div className="p-6 border border-white/10 rounded-xl hover:border-[#00FFFF] transition-colors group cursor-pointer">
                                <h4 className="text-xl font-bold text-white mb-2 group-hover:text-[#00FFFF]">Private Identity</h4>
                                <p className="text-gray-400 text-sm mb-4">KYC verification where user data never leaves the device.</p>
                                <span className="text-xs font-mono text-gray-500">github.com/obscura/examples/identity</span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Resources Grid for quick access - Clicking these switches tab */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 pt-12 border-t border-white/10">
                    <ResourceCard
                        icon={<Code className="text-purple-400" />}
                        title="Documentation"
                        desc="Deep dive into our architecture, smart contracts, and WASM runtime."
                        onClick={() => setActiveSection('docs')}
                    />
                    <ResourceCard
                        icon={<BookOpen className="text-blue-400" />}
                        title="API Reference"
                        desc="Complete JSON-RPC and REST API endpoints for node interaction."
                        onClick={() => setActiveSection('api')}
                    />
                    <ResourceCard
                        icon={<Layers className="text-green-400" />}
                        title="Example dApps"
                        desc="Cloneable repositories for DeFi, Gaming, and Identity use cases."
                        onClick={() => setActiveSection('examples')}
                    />
                </div>
            </motion.div>
        </div>
    );
};

const ResourceCard = ({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick?: () => void }) => (
    <motion.div
        whileHover={{ y: -5 }}
        onClick={onClick}
        className="card-glass hover:bg-white/10 cursor-pointer p-6"
    >
        <div className="mb-4">{icon}</div>
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-400 md:text-gray-300">{desc}</p>
    </motion.div>
);

export default Developers;
