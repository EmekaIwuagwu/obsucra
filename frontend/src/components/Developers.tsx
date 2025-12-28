import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Copy, Check, Code, BookOpen, Layers, ExternalLink, Play, ChevronRight, Database, Shield, Globe } from 'lucide-react';

interface ApiEndpoint {
    method: 'GET' | 'POST';
    path: string;
    description: string;
    response?: string;
    params?: { name: string; type: string; required: boolean; description: string }[];
}

const Developers: React.FC = () => {
    const [copied, setCopied] = useState(false);
    const [activeSection, setActiveSection] = useState<'quickstart' | 'docs' | 'api' | 'examples'>('quickstart');
    const [apiResponse, setApiResponse] = useState<string | null>(null);
    const [loadingApi, setLoadingApi] = useState(false);
    const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const testApiEndpoint = async (endpoint: string) => {
        setLoadingApi(true);
        setApiResponse(null);
        try {
            const response = await fetch(`http://localhost:8080${endpoint}`);
            const data = await response.json();
            setApiResponse(JSON.stringify(data, null, 2));
        } catch (err) {
            setApiResponse(JSON.stringify({ error: 'Failed to fetch. Make sure the backend is running on localhost:8080' }, null, 2));
        }
        setLoadingApi(false);
    };

    const apiEndpoints: ApiEndpoint[] = [
        {
            method: 'GET',
            path: '/api/stats',
            description: 'Returns node telemetry including uptime, proofs generated, and OEV recaptured.',
            response: '{ "uptime": "99.97%", "totalProofs": 15847, "oevRecaptured": "$124,567" }'
        },
        {
            method: 'GET',
            path: '/api/feeds',
            description: 'Returns list of active data feeds with live values, confidence intervals, and ZK status.',
            response: '[{ "id": "ETH-USD", "value": "3847.52", "confidence": 99.2, "isZKVerified": true }]'
        },
        {
            method: 'GET',
            path: '/api/jobs',
            description: 'Returns the last 50 processed oracle requests (Price Feeds, VRF, ZK Compute).',
            response: '[{ "id": "job-123", "type": "PriceFeed", "status": "completed", "latency": "45ms" }]'
        },
        {
            method: 'GET',
            path: '/api/proposals',
            description: 'Returns the list of community governance proposals for the DAO.',
            response: '[{ "id": 1, "title": "Increase Rewards", "status": "Active", "votes_for": 72 }]'
        },
        {
            method: 'GET',
            path: '/api/network',
            description: 'Returns network-wide statistics including TVL, active nodes, and throughput.',
            response: '{ "totalValueSecured": "$2.4B", "activeNodes": 47, "dataPointsPerDay": 1250000 }'
        },
        {
            method: 'GET',
            path: '/api/chains',
            description: 'Returns supported blockchain status with TPS, block height, and latency.',
            response: '[{ "id": "eth", "name": "Ethereum", "tps": "12.5", "status": "Optimal" }]'
        },
    ];

    const docSections = [
        {
            id: 'architecture',
            title: 'Architecture Overview',
            summary: 'Learn how Obscura Nodes communicate via LibP2P and aggregate data using recursive SNARKs.',
            content: `
## Obscura Network Architecture

The Obscura Network consists of three main layers:

### 1. Data Layer
- **External Adapters**: Connect to CoinGecko, Binance, CoinMarketCap, and institutional APIs
- **Privacy Layer**: ZK-proofs ensure data validity without revealing source details
- **Aggregation**: Median-based consensus across multiple data sources

### 2. Node Layer  
- **LibP2P Transport**: Decentralized peer-to-peer communication
- **Consensus Engine**: BFT-based agreement on data values
- **TEE Integration**: Trusted Execution Environments for sensitive computations

### 3. Settlement Layer
- **Multi-chain Support**: Ethereum, Arbitrum, Optimism, Base
- **Smart Contracts**: ObscuraOracle, StakeGuard, NodeRegistry
- **OEV Recapture**: Automated MEV redistribution to users
            `
        },
        {
            id: 'contracts',
            title: 'Smart Contracts',
            summary: 'Solidity interfaces for ObscuraOracle.sol, StakeGuard.sol, and NodeRegistry.sol.',
            content: `
## Smart Contract Interfaces

### ObscuraOracle.sol
\`\`\`solidity
interface IObscuraOracle {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    
    function requestData(
        string calldata apiUrl,
        uint256 min,
        uint256 max,
        string calldata metadata
    ) external returns (uint256 requestId);
    
    function requestRandomness(string calldata seed) 
        external returns (uint256 requestId);
}
\`\`\`

### StakeGuard.sol
\`\`\`solidity
interface IStakeGuard {
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
    function slash(address node, uint256 amount, string reason) external;
    function stakers(address) external view returns (
        uint256 balance,
        uint256 unbondTime,
        int256 reputation,
        bool isActive
    );
}
\`\`\`

### NodeRegistry.sol
\`\`\`solidity
interface INodeRegistry {
    function registerNode(
        string name,
        string endpoint,
        bytes32 publicKey
    ) external;
    function getActiveNodes() external view returns (address[]);
    function startConsensus(bytes32 requestId) external;
}
\`\`\`
            `
        },
        {
            id: 'security',
            title: 'Security Model',
            summary: 'Understanding slashing conditions, reputation scores, and TEE attestation.',
            content: `
## Security Model

### Slashing Conditions
Nodes can be slashed for:
1. **Price Deviation**: Submitting values >5% from median
2. **Downtime**: Missing >10% of assigned requests
3. **Byzantine Behavior**: Detected through ZK fraud proofs

### Reputation System
- New nodes start at 50% reputation (5000/10000)
- Successful jobs increase reputation by 1%
- Failed/slashed jobs decrease by 2-5%
- Minimum 30% reputation required for consensus participation

### TEE Attestation
- Intel SGX enclaves for sensitive API key storage
- Remote attestation before node activation
- Secure key derivation for ZK proof generation
            `
        },
        {
            id: 'zkproofs',
            title: 'Zero-Knowledge Proofs',
            summary: 'Groth16 circuits for range proofs, VRF proofs, and cross-chain bridge proofs.',
            content: `
## ZK Proof System

### Supported Circuits

#### 1. Range Proof
Proves a value is within bounds without revealing the exact value.
\`\`\`
Circuit: RangeProofCircuit
Inputs: Value (private), Min, Max (public)
Proof Size: ~192 bytes
Verification Gas: ~250,000
\`\`\`

#### 2. VRF Proof
Verifiable Random Function for provably fair randomness.
\`\`\`
Circuit: VRFProofCircuit  
Inputs: Seed, PrivateKey (private), PublicKey (public)
Output: RandomValue, Proof
\`\`\`

#### 3. Bridge Proof
Cross-chain state verification.
\`\`\`
Circuit: BridgeProofCircuit
Inputs: SourceChainState, MerkleProof (private)
Output: ValidatedState
\`\`\`

### Libraries Used
- **gnark**: Go-based ZK library
- **Groth16**: Proving system
- **BN254**: Elliptic curve
            `
        }
    ];

    const exampleApps = [
        {
            title: 'Prediction Market',
            description: 'A decentralized betting platform using Obscura for sports results and election outcomes.',
            github: 'github.com/obscura/examples/prediction-market',
            features: ['Real-time price feeds', 'VRF for fair resolution', 'OEV protection'],
            language: 'Solidity + React'
        },
        {
            title: 'Private Identity',
            description: 'KYC verification where user data never leaves the device. ZK proofs verify age/location.',
            github: 'github.com/obscura/examples/private-identity',
            features: ['ZK age verification', 'On-device processing', 'GDPR compliant'],
            language: 'TypeScript + circom'
        },
        {
            title: 'DeFi Lending',
            description: 'Collateralized lending protocol with ZK-verified price feeds and liquidation protection.',
            github: 'github.com/obscura/examples/defi-lending',
            features: ['Chainlink-compatible', 'Multi-asset support', 'Flash loan protection'],
            language: 'Solidity + Hardhat'
        },
        {
            title: 'NFT Lottery',
            description: 'Fair NFT distribution using Obscura VRF for provably random winner selection.',
            github: 'github.com/obscura/examples/nft-lottery',
            features: ['VRF randomness', 'On-chain verification', 'Gas optimized'],
            language: 'Solidity + ethers.js'
        }
    ];

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
                                    onClick={() => handleCopy('npm install @obscura-network/sdk ethers')}
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
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <h3 className="text-3xl font-bold text-white mb-6">Core Documentation</h3>
                        {docSections.map((doc) => (
                            <div key={doc.id} className="card-glass overflow-hidden">
                                <button
                                    onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                                    className="w-full p-6 flex justify-between items-center hover:bg-white/5 transition-colors"
                                >
                                    <div className="text-left">
                                        <h4 className="font-bold text-[#00FFFF] mb-1">{doc.title}</h4>
                                        <p className="text-sm text-gray-400">{doc.summary}</p>
                                    </div>
                                    <ChevronRight className={`text-gray-400 transition-transform ${expandedDoc === doc.id ? 'rotate-90' : ''}`} />
                                </button>
                                {expandedDoc === doc.id && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        className="px-6 pb-6 border-t border-white/10"
                                    >
                                        <div className="prose prose-invert prose-sm max-w-none pt-4">
                                            <pre className="bg-black/40 rounded-xl p-4 overflow-x-auto text-sm text-gray-300 whitespace-pre-wrap">
                                                {doc.content}
                                            </pre>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        ))}
                    </motion.div>
                )}

                {activeSection === 'api' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-3xl font-bold text-white">API Reference (v1.0)</h3>
                            <span className="px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-bold">
                                Base URL: http://localhost:8080
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {apiEndpoints.map((endpoint, idx) => (
                                <div key={idx} className="card-glass p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${endpoint.method === 'GET' ? 'bg-green-900 text-green-400' : 'bg-blue-900 text-blue-400'}`}>
                                                {endpoint.method}
                                            </span>
                                            <code className="text-white font-mono">{endpoint.path}</code>
                                        </div>
                                        <button
                                            onClick={() => testApiEndpoint(endpoint.path)}
                                            className="px-3 py-1 bg-[#00FFFF]/10 border border-[#00FFFF]/30 rounded text-xs font-bold text-[#00FFFF] hover:bg-[#00FFFF] hover:text-black transition-all flex items-center gap-1"
                                        >
                                            <Play size={12} />
                                            Try It
                                        </button>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-3">{endpoint.description}</p>
                                    <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-gray-500">
                                        <span className="text-gray-600">// Example response</span>
                                        <br />
                                        {endpoint.response}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Live API Response */}
                        {(loadingApi || apiResponse) && (
                            <div className="card-glass p-6 mt-8">
                                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Database className="text-purple-400" />
                                    Live API Response
                                </h4>
                                {loadingApi ? (
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                                        Fetching...
                                    </div>
                                ) : (
                                    <pre className="bg-black/60 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto max-h-64">
                                        {apiResponse}
                                    </pre>
                                )}
                            </div>
                        )}

                        <div className="mt-8 p-6 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                            <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                <Shield className="text-blue-400" />
                                Authenticated Enterprise Endpoints
                            </h4>
                            <p className="text-gray-400 text-sm">
                                Private endpoints require injection from the node's secure vault. Use the Enterprise Gateway UI to manage institutional credentials.
                            </p>
                        </div>
                    </motion.div>
                )}

                {activeSection === 'examples' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h3 className="text-3xl font-bold text-white mb-6">Example dApps</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {exampleApps.map((app, idx) => (
                                <motion.div
                                    key={idx}
                                    whileHover={{ y: -5 }}
                                    className="card-glass p-6 hover:border-[#00FFFF]/30 transition-all cursor-pointer group"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className="text-xl font-bold text-white group-hover:text-[#00FFFF]">{app.title}</h4>
                                        <span className="text-xs px-2 py-1 bg-purple-900/30 text-purple-400 rounded">{app.language}</span>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-4">{app.description}</p>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {app.features.map((f, i) => (
                                            <span key={i} className="text-xs px-2 py-1 bg-white/5 text-gray-400 rounded">{f}</span>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-mono text-gray-500 group-hover:text-[#00FFFF]">
                                        <Globe size={12} />
                                        {app.github}
                                        <ExternalLink size={12} className="ml-auto" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Resources Grid for quick access */}
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
