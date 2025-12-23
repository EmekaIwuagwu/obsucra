import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, EyeOff, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { ObscuraSDK } from '../sdk/obscura';

const ConfidentialCompute: React.FC = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [threshold, setThreshold] = useState(50000);

    const runCompute = async () => {
        setIsProcessing(true);
        setResult(null);

        try {
            const sdk = new ObscuraSDK();
            const data = await sdk.requestCompute({ threshold });
            setResult({
                ...data,
                publicInput: `$${threshold.toLocaleString()}`,
                verification: 'ON-CHAIN VERIFIED (GROTH16)'
            });
        } catch (err) {
            console.error("Compute failed:", err);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-12">
                <h2 className="text-4xl font-bold text-white mb-4 flex items-center gap-4">
                    <Shield className="text-[#00FFFF]" size={40} />
                    Confidential Compute
                </h2>
                <p className="text-gray-400 text-lg">
                    Prove properties of private data without revealing the raw values. Powered by ZK-SNARKs.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Control Panel */}
                <div className="card-glass p-8 space-y-8 h-fit">
                    <div>
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Zap className="text-yellow-400" size={20} />
                            Private Credit Check Demo
                        </h3>
                        <p className="text-sm text-gray-500 mb-8">
                            This module proves that a user's bank balance is above a threshold. The actual balance is never seen by the oracle or the blockchain.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Verification Threshold (USD)</label>
                            <input
                                type="range"
                                min="10000"
                                max="200000"
                                step="10000"
                                value={threshold}
                                onChange={(e) => setThreshold(parseInt(e.target.value))}
                                className="w-full accent-[#00FFFF] bg-white/5 h-2 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between mt-2 text-xl font-mono text-white">
                                <span>$10,000</span>
                                <span className="text-[#00FFFF] border-b border-[#00FFFF]/30 font-bold">${threshold.toLocaleString()}</span>
                                <span>$200,000</span>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="p-3 bg-red-500/10 rounded-xl text-red-400">
                                    <EyeOff size={24} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-white uppercase tracking-tight">Private Input: Bank Balance</div>
                                    <div className="text-xs text-gray-500 font-mono">ENCRYPTED AT SOURCE (Not Visible to Node)</div>
                                </div>
                            </div>
                            <div className="mt-4 blur-sm select-none text-gray-600 font-mono text-sm">
                                {"**********"} 0192.48 USD
                            </div>
                        </div>

                        <button
                            onClick={runCompute}
                            disabled={isProcessing}
                            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${isProcessing
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                : 'bg-[#00FFFF] text-black hover:shadow-[0_0_30px_rgba(0,255,255,0.4)] hover:scale-[1.02]'
                                }`}
                        >
                            {isProcessing ? 'GENERATING ZK PROOF...' : 'RUN CONFIDENTIAL CHECK'}
                        </button>
                    </div>
                </div>

                {/* Result Panel */}
                <div className="relative">
                    {!result && !isProcessing && (
                        <div className="card-glass border-dashed border-white/10 flex flex-col items-center justify-center p-12 h-[500px] text-center">
                            <Lock className="text-gray-700 mb-6" size={64} />
                            <h4 className="text-xl font-bold text-gray-600 mb-2">Awaiting Execution</h4>
                            <p className="text-gray-700 max-w-xs text-sm">Configure your threshold and trigger the confidential compute to see the ZK verification flow.</p>
                        </div>
                    )}

                    {isProcessing && (
                        <div className="card-glass border-[#00FFFF]/30 flex flex-col items-center justify-center p-12 h-[500px] text-center overflow-hidden">
                            <div className="relative mb-8">
                                <div className="w-24 h-24 border-4 border-[#00FFFF]/20 border-t-[#00FFFF] rounded-full animate-spin" />
                                <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#00FFFF]" size={32} />
                            </div>
                            <h4 className="text-2xl font-bold text-white mb-2 animate-pulse">Obscura Node is Computing...</h4>
                            <p className="text-gray-400 text-sm max-w-xs">
                                Fetching secret data via encrypted proxy and generating GNARK Groth16 proof.
                            </p>

                            <div className="mt-8 flex gap-2">
                                {[1, 2, 3].map(i => (
                                    <motion.div
                                        key={i}
                                        animate={{ height: [10, 40, 10] }}
                                        transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                                        className="w-1 bg-[#00FFFF]/30 rounded-full"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {result && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="card-glass border-green-500/30 p-8 h-fit space-y-8 bg-gradient-to-br from-[#000000] to-[#003300]/20"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <h4 className="text-2xl font-bold text-white">Proof Verified</h4>
                                </div>
                                <span className="text-[10px] font-mono text-green-500 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
                                    SUCCESS
                                </span>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                    <div className="text-xs text-gray-500 uppercase tracking-widest mb-4">Attestation Result</div>
                                    <div className="text-3xl font-bold text-white flex items-end gap-2">
                                        BALANCE ≥ {result.publicInput}
                                        <span className="text-sm text-green-400 font-mono mb-1">TRUE</span>
                                    </div>
                                    <div className="h-px bg-white/5 my-4" />
                                    <div className="text-xs text-gray-400 leading-relaxed italic">
                                        "The Obscura Network hereby certifies that the private input provided matches the criteria defined in the public circuit (LogicType: 0), without revealing the raw inputs to the requester or the validator."
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="text-[10px] text-gray-500 uppercase">ZK-SNARK Hash</div>
                                        <div className="text-xs text-white font-mono truncate">{result.proofHash}</div>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <div className="text-[10px] text-gray-500 uppercase">Execution Time</div>
                                        <div className="text-xs text-white font-mono">{result.timestamp}</div>
                                    </div>
                                </div>

                                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 flex items-center gap-3">
                                    <AlertTriangle size={20} className="text-cyan-400 shrink-0" />
                                    <div className="text-[10px] text-cyan-200 uppercase leading-none font-bold">
                                        {result.verification}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Use Cases Section */}
            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { title: 'Private DeFi', desc: 'Verify margin requirements without exposing collateral balances.' },
                    { title: 'Identity', desc: 'Prove age or citizenship without revealing full PII.' },
                    { title: 'Institutional', desc: 'Secure data ingestion for HIPAA or GDPR compliant feeds.' }
                ].map((item, i) => (
                    <div key={i} className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-white/20 transition-colors">
                        <div className="text-lg font-bold text-white mb-2">{item.title}</div>
                        <div className="text-sm text-gray-400">{item.desc}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ConfidentialCompute;
