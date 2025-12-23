import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ObscuraSDK } from '../sdk/obscura';

const Governance: React.FC = () => {
    const [proposals, setProposals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const sdk = new ObscuraSDK();
        const fetchProposals = async () => {
            try {
                const data = await sdk.getProposals();
                setProposals(data);
            } catch (err) {
                console.error("Failed to fetch proposals:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchProposals();
    }, []);

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                Governance DAO
            </h2>

            <div className="space-y-6">
                {loading && (
                    <div className="flex justify-center p-20">
                        <div className="w-8 h-8 border-4 border-[#4f46e5]/20 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                )}
                {!loading && proposals.map((prop) => (
                    <motion.div
                        key={prop.id}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="card-glass hover:bg-white/5 transition-colors"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-white">{prop.title}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${prop.status === 'Active' ? 'bg-green-900 text-green-400' : 'bg-orange-900 text-orange-400'}`}>
                                {prop.status}
                            </span>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>For</span>
                                    <span>{prop.votes_for}%</span>
                                </div>
                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${prop.votes_for}%` }}
                                        transition={{ duration: 1, delay: 0.2 }}
                                        className="h-full bg-gradient-to-r from-green-400 to-green-600 shadow-[0_0_10px_#4ade80]"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>Against</span>
                                    <span>{prop.votes_against}%</span>
                                </div>
                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${prop.votes_against}%` }}
                                        transition={{ duration: 1, delay: 0.2 }}
                                        className="h-full bg-gradient-to-r from-red-400 to-red-600 shadow-[0_0_10px_#f87171]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-3">
                            <button
                                onClick={() => alert(`Showing details for proposal: ${prop.title}`)}
                                className="px-4 py-2 border border-gray-600 hover:border-white rounded text-sm transition-colors text-gray-300 hover:text-white"
                            >
                                View Details
                            </button>
                            <button
                                onClick={() => alert(`Casting vote for proposal: ${prop.title}`)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm text-white font-bold transition-colors shadow-[0_0_10px_#4f46e5]"
                            >
                                Vote
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default Governance;
