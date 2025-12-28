import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Key, Database, CheckCircle, Lock, Building2, Globe, X, Eye, EyeOff, Copy, Check, Plus, Trash2 } from 'lucide-react';

interface Credential {
    id: string;
    name: string;
    url: string;
    apiKey: string;
    status: 'active' | 'inactive';
    type: string;
    lastUsed: string;
}

const EnterpriseGateway: React.FC = () => {
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [showCredentialModal, setShowCredentialModal] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);
    const [credentials, setCredentials] = useState<Credential[]>([
        { id: '1', name: 'Bloomberg Terminal', url: 'https://api.bloomberg-institutional.com/v1', apiKey: 'BL_xxxxxxxxxxxxx', status: 'active', type: 'Financial', lastUsed: '2 min ago' },
        { id: '2', name: 'Private Credit Repo', url: 'https://api.private-credit.org', apiKey: 'PC_xxxxxxxxxxxxx', status: 'active', type: 'Credit', lastUsed: '15 min ago' },
        { id: '3', name: 'EU Identity Vault', url: 'https://secure.auth.eu', apiKey: 'EU_xxxxxxxxxxxxx', status: 'inactive', type: 'Identity', lastUsed: 'Never' },
    ]);
    const [newCredential, setNewCredential] = useState({ name: '', url: '', apiKey: '', type: 'Financial' });

    const authenticatedSources = [
        { name: 'Bloomberg Terminal (Institutional)', url: 'https://api.bloomberg-institutional.com/v1/price', status: 'Secured', type: 'Financial' },
        { name: 'Private Credit Repository', url: 'https://api.private-credit.org/scores', status: 'Secured', type: 'Credit' },
        { name: 'EU Identity Vault', url: 'https://secure.auth.eu/verify', status: 'Inert', type: 'Identity' },
    ];

    const handleManageCredentials = (sourceName: string) => {
        setSelectedSource(sourceName);
        setShowCredentialModal(true);
    };

    const handleCopyKey = (key: string) => {
        navigator.clipboard.writeText(key);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const handleAddCredential = () => {
        if (newCredential.name && newCredential.url && newCredential.apiKey) {
            setCredentials([...credentials, {
                id: Date.now().toString(),
                ...newCredential,
                status: 'active',
                lastUsed: 'Never'
            }]);
            setNewCredential({ name: '', url: '', apiKey: '', type: 'Financial' });
        }
    };

    const handleDeleteCredential = (id: string) => {
        setCredentials(credentials.filter(c => c.id !== id));
    };

    const handleToggleStatus = (id: string) => {
        setCredentials(credentials.map(c =>
            c.id === id ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' } : c
        ));
    };

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
                            <button
                                onClick={() => handleManageCredentials(source.name)}
                                className="mt-4 px-4 py-2 bg-[#00FFFF]/10 border border-[#00FFFF]/20 rounded-lg text-[10px] font-bold text-[#00FFFF] hover:bg-[#00FFFF] hover:text-black transition-all"
                            >
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

            {/* Credential Management Modal */}
            <AnimatePresence>
                {showCredentialModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowCredentialModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#0a0a1a] border border-white/10 rounded-2xl p-8 max-w-3xl w-full max-h-[80vh] overflow-y-auto"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <Key className="text-[#00FFFF]" />
                                    Credential Manager
                                </h3>
                                <button onClick={() => setShowCredentialModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            <p className="text-gray-400 mb-6 text-sm">
                                Managing credentials for: <span className="text-[#00FFFF] font-bold">{selectedSource}</span>
                            </p>

                            {/* Existing Credentials */}
                            <div className="space-y-4 mb-8">
                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Database size={18} className="text-purple-400" />
                                    Active Credentials
                                </h4>
                                {credentials.map((cred) => (
                                    <div key={cred.id} className="bg-black/40 border border-white/10 rounded-xl p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h5 className="text-white font-bold">{cred.name}</h5>
                                                <p className="text-xs text-gray-500 font-mono mt-1">{cred.url}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${cred.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                                {cred.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-3">
                                            <div className="flex-1 bg-black/60 rounded px-3 py-2 font-mono text-sm text-gray-400">
                                                {showApiKey ? cred.apiKey : '••••••••••••••••'}
                                            </div>
                                            <button onClick={() => setShowApiKey(!showApiKey)} className="p-2 text-gray-400 hover:text-white">
                                                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                            <button onClick={() => handleCopyKey(cred.apiKey)} className="p-2 text-gray-400 hover:text-[#00FFFF]">
                                                {copiedKey ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                                            </button>
                                        </div>
                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                                            <span className="text-xs text-gray-500">Last used: {cred.lastUsed}</span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleToggleStatus(cred.id)}
                                                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${cred.status === 'active' ? 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50' : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'}`}
                                                >
                                                    {cred.status === 'active' ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCredential(cred.id)}
                                                    className="p-1 text-red-400 hover:text-red-300"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Add New Credential */}
                            <div className="border-t border-white/10 pt-6">
                                <h4 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                                    <Plus size={18} className="text-green-400" />
                                    Add New Credential
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        placeholder="Source Name"
                                        value={newCredential.name}
                                        onChange={(e) => setNewCredential({ ...newCredential, name: e.target.value })}
                                        className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-[#00FFFF]/50 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="API Endpoint URL"
                                        value={newCredential.url}
                                        onChange={(e) => setNewCredential({ ...newCredential, url: e.target.value })}
                                        className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-[#00FFFF]/50 focus:outline-none"
                                    />
                                    <input
                                        type="password"
                                        placeholder="API Key / Secret"
                                        value={newCredential.apiKey}
                                        onChange={(e) => setNewCredential({ ...newCredential, apiKey: e.target.value })}
                                        className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-[#00FFFF]/50 focus:outline-none"
                                    />
                                    <select
                                        value={newCredential.type}
                                        onChange={(e) => setNewCredential({ ...newCredential, type: e.target.value })}
                                        className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#00FFFF]/50 focus:outline-none"
                                    >
                                        <option value="Financial">Financial</option>
                                        <option value="Credit">Credit</option>
                                        <option value="Identity">Identity</option>
                                        <option value="Custom">Custom</option>
                                    </select>
                                </div>
                                <button
                                    onClick={handleAddCredential}
                                    className="mt-4 w-full py-3 bg-[#00FFFF] text-black font-bold rounded-lg hover:bg-[#00FFFF]/80 transition-all"
                                >
                                    Add Credential to Vault
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default EnterpriseGateway;
