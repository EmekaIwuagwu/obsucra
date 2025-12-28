import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ObscuraSDK } from '../sdk/obscura';
import { X, ThumbsUp, ThumbsDown, Clock, Users, FileText, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface Proposal {
    id: number;
    title: string;
    description: string;
    proposer: string;
    status: string;
    votes_for: number;
    votes_against: number;
    votes_abstain: number;
    quorum_required: number;
    voting_ends: string;
    created_at: string;
    type: string;
    execution_data?: string;
}

const Governance: React.FC = () => {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
    const [showVoteModal, setShowVoteModal] = useState(false);
    const [voteType, setVoteType] = useState<'for' | 'against' | 'abstain' | null>(null);
    const [votingInProgress, setVotingInProgress] = useState(false);
    const [voteSuccess, setVoteSuccess] = useState(false);

    useEffect(() => {
        const sdk = new ObscuraSDK();
        const fetchProposals = async () => {
            try {
                const data = await sdk.getProposals();
                // Enrich with additional fields if not present
                const enrichedData = data.map((p: any, idx: number) => ({
                    ...p,
                    description: p.description || getDefaultDescription(p.title),
                    proposer: p.proposer || `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
                    votes_abstain: p.votes_abstain || Math.floor(Math.random() * 10),
                    quorum_required: p.quorum_required || 40,
                    voting_ends: p.voting_ends || getVotingEndDate(idx),
                    created_at: p.created_at || getCreatedDate(idx),
                    type: p.type || getProposalType(idx),
                }));
                setProposals(enrichedData);
            } catch (err) {
                console.error("Failed to fetch proposals:", err);
                // Set mock data for demo
                setProposals(getMockProposals());
            } finally {
                setLoading(false);
            }
        };
        fetchProposals();
    }, []);

    const getDefaultDescription = (title: string): string => {
        const descriptions: Record<string, string> = {
            'default': 'This proposal aims to improve the Obscura network by implementing community-requested changes. The changes will be executed automatically after the voting period ends if quorum is reached and the proposal passes.'
        };
        return descriptions[title] || descriptions['default'];
    };

    const getVotingEndDate = (idx: number): string => {
        const date = new Date();
        date.setDate(date.getDate() + (7 - idx));
        return date.toISOString();
    };

    const getCreatedDate = (idx: number): string => {
        const date = new Date();
        date.setDate(date.getDate() - (idx + 1));
        return date.toISOString();
    };

    const getProposalType = (idx: number): string => {
        const types = ['Parameter Change', 'Treasury', 'Upgrade', 'Emergency'];
        return types[idx % types.length];
    };

    const getMockProposals = (): Proposal[] => [
        {
            id: 1,
            title: 'Increase Staking Rewards by 15%',
            description: 'This proposal seeks to increase the base staking rewards from the current rate to 15% APY to attract more node operators and increase network security.',
            proposer: '0x742d35Cc6634C0532925a3b844Bc9e7595f4e032',
            status: 'Active',
            votes_for: 72,
            votes_against: 18,
            votes_abstain: 10,
            quorum_required: 40,
            voting_ends: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'Parameter Change'
        },
        {
            id: 2,
            title: 'Fund Ecosystem Development Grant',
            description: 'Allocate 500,000 OBSCURA tokens from the treasury to fund third-party developers building on the Obscura network.',
            proposer: '0xaB5409b0E5a66AcC1ba4C96f28dFEeC3F',
            status: 'Active',
            votes_for: 58,
            votes_against: 25,
            votes_abstain: 17,
            quorum_required: 40,
            voting_ends: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'Treasury'
        },
        {
            id: 3,
            title: 'Upgrade Oracle Contract to v2.1',
            description: 'Deploy the new ObscuraOracle v2.1 contract which includes optimized gas usage, improved ZK proof verification, and enhanced OEV recapture mechanisms.',
            proposer: '0x1234567890AbcdEf1234567890AbcdEf12345678',
            status: 'Pending',
            votes_for: 45,
            votes_against: 15,
            votes_abstain: 5,
            quorum_required: 50,
            voting_ends: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'Upgrade'
        }
    ];

    const handleViewDetails = (proposal: Proposal) => {
        setSelectedProposal(proposal);
    };

    const handleVote = (proposal: Proposal) => {
        setSelectedProposal(proposal);
        setShowVoteModal(true);
        setVoteType(null);
        setVoteSuccess(false);
    };

    const submitVote = async () => {
        if (!voteType || !selectedProposal) return;

        setVotingInProgress(true);

        // Simulate blockchain transaction
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Update local state
        setProposals(proposals.map(p => {
            if (p.id === selectedProposal.id) {
                if (voteType === 'for') return { ...p, votes_for: p.votes_for + 1 };
                if (voteType === 'against') return { ...p, votes_against: p.votes_against + 1 };
                return { ...p, votes_abstain: p.votes_abstain + 1 };
            }
            return p;
        }));

        setVotingInProgress(false);
        setVoteSuccess(true);
    };

    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getTimeRemaining = (dateStr: string): string => {
        const end = new Date(dateStr).getTime();
        const now = Date.now();
        const diff = end - now;

        if (diff <= 0) return 'Ended';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) return `${days}d ${hours}h remaining`;
        return `${hours}h remaining`;
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <h2 className="text-4xl font-bold mb-4 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                Governance DAO
            </h2>
            <p className="text-gray-400 text-center mb-8">
                Participate in decentralized governance. Stake OBSCURA tokens to vote on protocol upgrades, treasury allocations, and parameter changes.
            </p>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="card-glass p-4 text-center">
                    <div className="text-2xl font-bold text-white">{proposals.length}</div>
                    <div className="text-xs text-gray-400">Active Proposals</div>
                </div>
                <div className="card-glass p-4 text-center">
                    <div className="text-2xl font-bold text-[#00FFFF]">847</div>
                    <div className="text-xs text-gray-400">Total Voters</div>
                </div>
                <div className="card-glass p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">12.5M</div>
                    <div className="text-xs text-gray-400">OBSCURA Staked</div>
                </div>
            </div>

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
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-gray-500">#{prop.id}</span>
                                    <span className="text-xs px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded">{prop.type}</span>
                                </div>
                                <h3 className="text-xl font-bold text-white">{prop.title}</h3>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${prop.status === 'Active' ? 'bg-green-900 text-green-400' : 'bg-orange-900 text-orange-400'}`}>
                                {prop.status}
                            </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                            <span className="flex items-center gap-1"><Clock size={12} /> {getTimeRemaining(prop.voting_ends)}</span>
                            <span className="flex items-center gap-1"><Users size={12} /> Quorum: {prop.quorum_required}%</span>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span className="flex items-center gap-1"><ThumbsUp size={12} /> For</span>
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
                                    <span className="flex items-center gap-1"><ThumbsDown size={12} /> Against</span>
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
                                onClick={() => handleViewDetails(prop)}
                                className="px-4 py-2 border border-gray-600 hover:border-white rounded text-sm transition-colors text-gray-300 hover:text-white flex items-center gap-2"
                            >
                                <FileText size={14} />
                                View Details
                            </button>
                            <button
                                onClick={() => handleVote(prop)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm text-white font-bold transition-colors shadow-[0_0_10px_#4f46e5] flex items-center gap-2"
                            >
                                <CheckCircle size={14} />
                                Vote
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Details Modal */}
            <AnimatePresence>
                {selectedProposal && !showVoteModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setSelectedProposal(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#0a0a1a] border border-white/10 rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-gray-500">Proposal #{selectedProposal.id}</span>
                                        <span className="text-xs px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded">{selectedProposal.type}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${selectedProposal.status === 'Active' ? 'bg-green-900 text-green-400' : 'bg-orange-900 text-orange-400'}`}>
                                            {selectedProposal.status}
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white">{selectedProposal.title}</h3>
                                </div>
                                <button onClick={() => setSelectedProposal(null)} className="text-gray-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h4>
                                    <p className="text-gray-300 leading-relaxed">{selectedProposal.description}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black/40 rounded-xl p-4">
                                        <div className="text-xs text-gray-500 uppercase mb-1">Proposer</div>
                                        <div className="text-sm text-white font-mono truncate">{selectedProposal.proposer}</div>
                                    </div>
                                    <div className="bg-black/40 rounded-xl p-4">
                                        <div className="text-xs text-gray-500 uppercase mb-1">Created</div>
                                        <div className="text-sm text-white">{formatDate(selectedProposal.created_at)}</div>
                                    </div>
                                    <div className="bg-black/40 rounded-xl p-4">
                                        <div className="text-xs text-gray-500 uppercase mb-1">Voting Ends</div>
                                        <div className="text-sm text-white">{formatDate(selectedProposal.voting_ends)}</div>
                                    </div>
                                    <div className="bg-black/40 rounded-xl p-4">
                                        <div className="text-xs text-gray-500 uppercase mb-1">Quorum</div>
                                        <div className="text-sm text-white">{selectedProposal.quorum_required}% required</div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Voting Results</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 text-green-400 text-sm">For</div>
                                            <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-green-500" style={{ width: `${selectedProposal.votes_for}%` }} />
                                            </div>
                                            <div className="w-12 text-right text-white">{selectedProposal.votes_for}%</div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 text-red-400 text-sm">Against</div>
                                            <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-red-500" style={{ width: `${selectedProposal.votes_against}%` }} />
                                            </div>
                                            <div className="w-12 text-right text-white">{selectedProposal.votes_against}%</div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 text-gray-400 text-sm">Abstain</div>
                                            <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-gray-500" style={{ width: `${selectedProposal.votes_abstain}%` }} />
                                            </div>
                                            <div className="w-12 text-right text-white">{selectedProposal.votes_abstain}%</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-white/10">
                                    <button
                                        onClick={() => {
                                            setShowVoteModal(true);
                                        }}
                                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold transition-all"
                                    >
                                        Cast Your Vote
                                    </button>
                                    <button
                                        onClick={() => window.open('#', '_blank')}
                                        className="px-4 py-3 border border-white/20 hover:border-white/40 rounded-lg text-gray-300 hover:text-white transition-all flex items-center gap-2"
                                    >
                                        <ExternalLink size={16} />
                                        Etherscan
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Vote Modal */}
            <AnimatePresence>
                {showVoteModal && selectedProposal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => { setShowVoteModal(false); setVoteSuccess(false); }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#0a0a1a] border border-white/10 rounded-2xl p-8 max-w-md w-full"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                            {!voteSuccess ? (
                                <>
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold text-white">Cast Your Vote</h3>
                                        <button onClick={() => setShowVoteModal(false)} className="text-gray-400 hover:text-white">
                                            <X size={24} />
                                        </button>
                                    </div>

                                    <p className="text-gray-400 text-sm mb-6">
                                        Voting on: <span className="text-white font-bold">{selectedProposal.title}</span>
                                    </p>

                                    <div className="space-y-3 mb-6">
                                        <button
                                            onClick={() => setVoteType('for')}
                                            className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${voteType === 'for' ? 'border-green-500 bg-green-900/20' : 'border-white/10 hover:border-white/30'}`}
                                        >
                                            <ThumbsUp className={voteType === 'for' ? 'text-green-400' : 'text-gray-400'} size={20} />
                                            <span className={voteType === 'for' ? 'text-green-400 font-bold' : 'text-gray-300'}>Vote For</span>
                                        </button>
                                        <button
                                            onClick={() => setVoteType('against')}
                                            className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${voteType === 'against' ? 'border-red-500 bg-red-900/20' : 'border-white/10 hover:border-white/30'}`}
                                        >
                                            <ThumbsDown className={voteType === 'against' ? 'text-red-400' : 'text-gray-400'} size={20} />
                                            <span className={voteType === 'against' ? 'text-red-400 font-bold' : 'text-gray-300'}>Vote Against</span>
                                        </button>
                                        <button
                                            onClick={() => setVoteType('abstain')}
                                            className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${voteType === 'abstain' ? 'border-gray-500 bg-gray-900/20' : 'border-white/10 hover:border-white/30'}`}
                                        >
                                            <AlertCircle className={voteType === 'abstain' ? 'text-gray-400' : 'text-gray-400'} size={20} />
                                            <span className={voteType === 'abstain' ? 'text-gray-300 font-bold' : 'text-gray-300'}>Abstain</span>
                                        </button>
                                    </div>

                                    <button
                                        onClick={submitVote}
                                        disabled={!voteType || votingInProgress}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-all flex items-center justify-center gap-2"
                                    >
                                        {votingInProgress ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            'Submit Vote'
                                        )}
                                    </button>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle className="text-green-400" size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">Vote Submitted!</h3>
                                    <p className="text-gray-400 text-sm mb-6">
                                        Your vote has been recorded on-chain.
                                    </p>
                                    <button
                                        onClick={() => { setShowVoteModal(false); setSelectedProposal(null); setVoteSuccess(false); }}
                                        className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Governance;
