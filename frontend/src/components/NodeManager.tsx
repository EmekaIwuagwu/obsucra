import React, { useState } from 'react';
import { motion } from 'framer-motion';

const NodeManager: React.FC = () => {
    const [nodeName, setNodeName] = useState('');
    const [endpoint, setEndpoint] = useState('');
    const [stake, setStake] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Registering Node:", { nodeName, endpoint, stake });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-white">
            <h2 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                Node Registration
            </h2>

            <motion.div
                className="w-full max-w-md card-glass"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.02, boxShadow: "0 0 25px rgba(139, 92, 246, 0.5)" }}
                transition={{ duration: 0.3 }}
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Node Name</label>
                        <input
                            type="text"
                            className="input-cosmic"
                            value={nodeName}
                            onChange={(e) => setNodeName(e.target.value)}
                            placeholder="e.g. Oracle-Alpha-01"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">RPC Endpoint</label>
                        <input
                            type="text"
                            className="input-cosmic"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            placeholder="https://..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Stake Amount (OBS)</label>
                        <input
                            type="number"
                            className="input-cosmic"
                            value={stake}
                            onChange={(e) => setStake(e.target.value)}
                            placeholder="Min. 1000 OBS"
                        />
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full btn-cosmic mt-4"
                        type="submit"
                    >
                        Register Node
                    </motion.button>
                </form>
            </motion.div>
        </div>
    );
};

export default NodeManager;
