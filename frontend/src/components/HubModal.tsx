import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Cpu, Activity, Database, Lock, Power } from 'lucide-react';

interface HubModalProps {
    isOpen: boolean;
    onClose: () => void;
    logs?: string[];
}

const HubModal: React.FC<HubModalProps> = ({ isOpen, onClose, logs = [] }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-5xl glass rounded-[2.5rem] border border-white/20 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                    >
                        {/* Header */}
                        <div className="px-10 py-8 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-gradient-to-tr from-highlight to-neon shadow-[0_0_15px_rgba(0,255,255,0.3)]">
                                    <Shield className="text-white w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black neon-text uppercase tracking-tighter">OBSCURA HUB</h2>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Network Node Management • v1.0.4-Alpha</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-3 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="grid grid-cols-1 lg:grid-cols-3">
                            {/* Sidebar Info */}
                            <div className="p-10 border-r border-white/10 bg-white/2 gap-8 flex flex-col">
                                <HubStat icon={<Activity size={20} className="text-neon" />} label="Node Identity" value="node_7x92...ff" />
                                <HubStat icon={<Database size={20} className="text-purple" />} label="Storage" value="2.4 / 10 TB" />
                                <HubStat icon={<Lock size={20} className="text-accent" />} label="ZK Enclave" value="Active (SGX)" />

                                <div className="mt-auto p-6 rounded-2xl bg-neon/10 border border-neon/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-neon animate-pulse" />
                                        <span className="text-[10px] font-black uppercase text-neon tracking-widest">Live Sync</span>
                                    </div>
                                    <div className="text-xs text-gray-300 font-medium">Downloading Block #8,421,092</div>
                                    <div className="mt-3 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: "65%" }}
                                            className="h-full bg-neon shadow-[0_0_10px_#00FFFF]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="lg:col-span-2 p-10 bg-black/20">
                                <div className="grid grid-cols-2 gap-6 mb-10">
                                    <ActionTile icon={<Cpu />} title="Start Enclave" desc="Boot the secure TEE environment" />
                                    <ActionTile icon={<Shield />} title="Reputation" desc="Check your validator ranking" />
                                    <ActionTile icon={<Database />} title="Data Jobs" desc="View active oracle requests" />
                                    <ActionTile icon={<Power className="text-red-500" />} title="Shutdown" desc="Safely disconnect from Mesh" danger />
                                </div>

                                <div className="p-8 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden h-64 overflow-y-auto">
                                    <div className="absolute top-0 right-0 p-4 bg-inherit backdrop-blur-md rounded-bl-2xl">
                                        <div className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Live Kernel Logs</div>
                                    </div>
                                    <div className="font-mono text-xs text-gray-400 space-y-2 pt-6">
                                        {logs.length > 0 ? logs.map((log, i) => (
                                            <div key={i} className={log.includes("ERR") ? "text-red-400" : log.includes("SUCCESS") ? "text-emerald-400" : log.includes("INFO") ? "text-neon" : "text-gray-400"}>
                                                {log}
                                            </div>
                                        )) : (
                                            <div className="text-gray-600 italic">Waiting for node telemetry...</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-10 py-4 bg-white/5 border-t border-white/10 flex justify-between items-center text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                            <span>Secured by ZK-Interlock™</span>
                            <span className="text-neon">Connection: encrypted (AES-256)</span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

function HubStat({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</span>
            </div>
            <div className="text-lg font-black">{value}</div>
        </div>
    );
}

function ActionTile({ icon, title, desc, danger = false }: { icon: React.ReactNode, title: string, desc: string, danger?: boolean }) {
    return (
        <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            className={`p-6 rounded-[1.5rem] border ${danger ? 'border-red-500/20 hover:bg-red-500/5' : 'border-white/10 hover:border-neon hover:bg-white/5'} transition-all text-left group`}
        >
            <div className={`mb-4 ${danger ? 'text-red-500' : 'text-neon'} group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <h4 className="font-black text-sm mb-1">{title}</h4>
            <p className="text-[10px] text-gray-500 font-medium leading-tight">{desc}</p>
        </motion.button>
    );
}

export default HubModal;
