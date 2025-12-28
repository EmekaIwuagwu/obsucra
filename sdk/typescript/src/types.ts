/**
 * Core types for Obscura SDK
 */

export interface ChainConfig {
    /** Chain identifier */
    chain: SupportedChain;
    /** RPC URL for blockchain connection */
    rpcUrl?: string;
    /** WebSocket URL for subscriptions */
    wsUrl?: string;
    /** Oracle contract address */
    oracleAddress?: string;
}

export type SupportedChain =
    | 'ethereum'
    | 'arbitrum'
    | 'base'
    | 'optimism'
    | 'polygon'
    | 'avalanche'
    | 'bnb'
    | 'zksync'
    | 'linea'
    | 'scroll'
    | 'mantle'
    | 'solana'
    | 'sepolia'
    | 'baseSepolia'
    | 'arbitrumSepolia';

export interface ClientConfig {
    /** Target blockchain */
    chain: SupportedChain;
    /** API key for premium features */
    apiKey?: string;
    /** Custom RPC URL */
    rpcUrl?: string;
    /** WebSocket URL for real-time subscriptions */
    wsUrl?: string;
    /** API endpoint for Obscura backend */
    apiEndpoint?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Request timeout in ms */
    timeout?: number;
}

export interface PriceData {
    /** Feed identifier (e.g., 'ETH/USD') */
    feedId: string;
    /** Price value as string (to avoid precision loss) */
    value: string;
    /** Number of decimals */
    decimals: number;
    /** Round ID for the oracle update */
    roundId: bigint;
    /** Timestamp of the update */
    timestamp: Date;
    /** Whether the data is ZK-verified */
    zkVerified: boolean;
    /** Confidence score (0-100) */
    confidence: number;
    /** ZK proof if requested */
    proof?: ZKProof;
    /** Merkle proof if requested */
    merkleProof?: MerkleProof;
}

export interface ZKProof {
    /** Proof data (8 uint256 values) */
    proof: string[];
    /** Public inputs for verification */
    publicInputs: string[];
    /** Proof type (range, vrf, bridge) */
    proofType: 'range' | 'vrf' | 'bridge' | 'twap';
}

export interface MerkleProof {
    /** Proof path hashes */
    path: string[];
    /** Position indicators */
    positions: boolean[];
    /** Merkle root */
    root: string;
    /** Tree height */
    height: number;
}

export interface GetPriceOptions {
    /** Include ZK proof in response */
    proof?: boolean;
    /** Include Merkle proof in response */
    merkleProof?: boolean;
    /** Maximum age of data in seconds */
    maxAge?: number;
    /** Force fresh data fetch */
    forceRefresh?: boolean;
}

export interface VRFRequest {
    /** Seed for randomness generation */
    seed: string;
    /** Number of random words to generate */
    numWords?: number;
    /** Callback gas limit */
    callbackGasLimit?: number;
}

export interface VRFResult {
    /** Request ID */
    requestId: string;
    /** Generated random values */
    randomWords: string[];
    /** VRF proof */
    proof: string;
    /** Timestamp */
    timestamp: Date;
}

export interface SubscriptionOptions {
    /** Minimum update interval in ms */
    minInterval?: number;
    /** Deviation threshold for updates (percentage) */
    deviationThreshold?: number;
    /** Include proof with each update */
    includeProof?: boolean;
}

export interface PriceUpdateEvent {
    feedId: string;
    value: string;
    decimals: number;
    roundId: bigint;
    timestamp: Date;
    latencyMs: number;
    confidence: number;
}

export type PriceUpdateCallback = (update: PriceUpdateEvent) => void;
export type ErrorCallback = (error: Error) => void;

export interface FeedMetadata {
    /** Feed identifier */
    feedId: string;
    /** Human-readable name */
    name: string;
    /** Category (crypto, forex, commodities, rwa) */
    category: 'crypto' | 'forex' | 'commodities' | 'rwa';
    /** Number of decimals */
    decimals: number;
    /** Heartbeat interval in seconds */
    heartbeat: number;
    /** Deviation threshold for updates */
    deviationThreshold: number;
    /** Supported chains */
    chains: SupportedChain[];
    /** Whether ZK proofs are available */
    zkEnabled: boolean;
}

export interface OracleStats {
    /** Total Value Secured in USD */
    tvs: string;
    /** Number of active feeds */
    activeFeeds: number;
    /** Number of active nodes */
    activeNodes: number;
    /** Average update latency in ms */
    avgLatency: number;
    /** 24h requests served */
    requests24h: number;
    /** Uptime percentage */
    uptime: number;
}

export interface NodeInfo {
    /** Node identifier */
    nodeId: string;
    /** Geographic region */
    region: string;
    /** Current status */
    status: 'active' | 'inactive' | 'slashed';
    /** Reputation score */
    reputation: number;
    /** Stake amount */
    stake: string;
    /** Response time percentile */
    responseTimeP95: number;
}

// Chain ID mapping
export const CHAIN_IDS: Record<SupportedChain, number> = {
    ethereum: 1,
    arbitrum: 42161,
    base: 8453,
    optimism: 10,
    polygon: 137,
    avalanche: 43114,
    bnb: 56,
    zksync: 324,
    linea: 59144,
    scroll: 534352,
    mantle: 5000,
    solana: -1, // Not EVM
    sepolia: 11155111,
    baseSepolia: 84532,
    arbitrumSepolia: 421614,
};

// Default RPC URLs (use your own for production)
export const DEFAULT_RPC_URLS: Partial<Record<SupportedChain, string>> = {
    sepolia: 'https://rpc.sepolia.org',
    baseSepolia: 'https://sepolia.base.org',
    arbitrumSepolia: 'https://sepolia-rollup.arbitrum.io/rpc',
};

// Default contract addresses (testnet)
export const DEFAULT_ORACLE_ADDRESSES: Partial<Record<SupportedChain, string>> = {
    sepolia: '0x0000000000000000000000000000000000000000', // Deploy and update
    baseSepolia: '0x0000000000000000000000000000000000000000',
    arbitrumSepolia: '0x0000000000000000000000000000000000000000',
};
