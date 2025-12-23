import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Key, Database, CheckCircle, Lock, Building2, Globe } from 'lucide-react';

const EnterpriseGateway: React.FC = () => {
    const authenticatedSources = [
        { name: 'Bloomberg Terminal (Institutional)', url: 'https://api.bloomberg-institutional.com/v1/price', status: 'Secured', type: 'Financial' },
        { name: 'Private Credit Repository', url: 'https://api.private-credit.org/scores', status: 'Secured', type: 'Credit' },
        { name: 'EU Identity Vault', url: 'https://secure.auth.eu/verify', status: 'Inert', type: 'Identity' },
    ];

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-12">
                <h2 className="text-4xl font-bold text-white mb-4 flex items-center gap-4">
                    <Building2 className="text-[#00FFFF]" size={40} />
                    First-Party Gateway
                </h2>
                <p className="text-gray-400 text-lg">
                    Directly authenticated ingestion from private institutional data sources. No third-party relays.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                <div className="card-glass p-6 border-cyan-500/20">
                    <div className="p-3 bg-cyan-500/10 rounded-xl w-fit text-cyan-400 mb-4">
                        <Key size={24} />
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2">Secure Vaulting</h4>
                    <p className="text-sm text-gray-500">API credentials are stored in the Obscura Secure Vault (AES-256) and never leave the node memory during execution.</p>
                </div>
                <div className="card-glass p-6 border-purple-500/20">
                    <div className="p-3 bg-purple-500/10 rounded-xl w-fit text-purple-400 mb-4">
                        <Database size={24} />
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2">Direct Ingestion</h4>
                    <p className="text-sm text-gray-500">Nodes act as first-party providers, fetching data directly from the source's authenticated endpoints.</p>
                </div>
                <div className="card-glass p-6 border-green-500/20">
                    <div className="p-3 bg-green-500/10 rounded-xl w-fit text-green-400 mb-4">
                        <CheckCircle size={24} />
                    </div>
                    <h4 className="text-lg font-bold text-white mb-2">Source Proofs</h4>
                    <p className="text-sm text-gray-500">Every response includes a cryptographic proof of source authenticity using TLSNotary-compatible attestations.</p>
                </div>
            </div>

            <h3 className="text-2xl font-bold text-white mb-8 border-b border-white/5 pb-4">Secured Enterprise Connections</h3>

            <div className="space-y-4">
                {authenticatedSources.map((source, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="card-glass p-6 flex justify-between items-center group hover:bg-white/5 transition-all"
                    >
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-black/40 rounded-2xl border border-white/10 group-hover:border-[#00FFFF]/30 transition-colors">
                                <Globe size={24} className="text-gray-500 group-hover:text-[#00FFFF]" />
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-white">{source.name}</h4>
                                <div className="text-sm font-mono text-gray-500 truncate max-w-md">{source.url}</div>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-400 uppercase font-bold tracking-tighter">
                                        Type: {source.type}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                            <div className={`flex items-center gap-2 justify-end font-bold text-xs uppercase tracking-widest ${source.status === 'Secured' ? 'text-green-400' : 'text-yellow-500'}`}>
                                {source.status === 'Secured' ? <Lock size={12} /> : null}
                                {source.status}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter">Vault Mapping Active</div>
                            <button className="mt-4 px-4 py-2 bg-[#00FFFF]/10 border border-[#00FFFF]/20 rounded-lg text-[10px] font-bold text-[#00FFFF] hover:bg-[#00FFFF] hover:text-black transition-all">
                                MANAGE CREDENTIALS
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-16 p-8 bg-blue-900/10 border border-blue-500/20 rounded-3xl flex items-center gap-8">
                <div className="p-6 bg-blue-500/20 rounded-full text-blue-400">
                    <Shield size={48} />
                </div>
                <div>
                    <h4 className="text-2xl font-bold text-white mb-2">Institutional-Grade Privacy</h4>
                    <p className="text-gray-400 leading-relaxed">
                        Obscura's First-Party Gateway is designed for banks and hedge funds that require strict authentication for data access.
                        By leveraging our secure hardware enclaves (TEE) and ZK-vaulting, we ensure that premium data remains private while being verifiable on-chain.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EnterpriseGateway;
