// Obscura Enterprise SDK
// TypeScript/JavaScript SDK for easy integration with DeFi protocols

export interface ObscuraConfig {
    rpcUrl: string;
    oracleAddress: string;
    privateKey?: string;
    network?: 'mainnet' | 'sepolia' | 'arbitrum' | 'optimism';
    timeout?: number;
}

export interface PriceFeed {
    id: string;
    name: string;
    value: string;
    decimals: number;
    timestamp: number;
    roundId: number;
    confidence: number;
    isZKVerified: boolean;
}

export interface OracleRequest {
    requestId: string;
    requester: string;
    feedId: string;
    status: 'pending' | 'fulfilled' | 'failed';
    value?: string;
    timestamp?: number;
}

export interface NodeInfo {
    address: string;
    name: string;
    reputation: number;
    stakedAmount: string;
    status: 'active' | 'inactive' | 'slashed';
}

export interface ReserveInfo {
    assetId: string;
    assetName: string;
    tokenAddress: string;
    reportedReserve: string;
    circulatingSupply: string;
    collateralRatio: number;
    status: 'healthy' | 'warning' | 'critical';
    lastUpdateTime: number;
}

/**
 * Obscura Enterprise SDK
 * 
 * Easy integration with the Obscura Oracle Network for:
 * - Price feeds with ZK verification
 * - VRF (Verifiable Random Function)
 * - Proof of Reserve
 * - Custom data requests
 * 
 * @example
 * ```typescript
 * import { ObscuraSDK } from '@obscura/sdk';
 * 
 * const sdk = new ObscuraSDK({
 *   rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
 *   oracleAddress: '0x...',
 * });
 * 
 * // Get ETH/USD price
 * const price = await sdk.getPrice('ETH-USD');
 * console.log(price.value); // "$3,847.52"
 * 
 * // Request VRF randomness
 * const random = await sdk.requestRandomness('my-seed');
 * console.log(random); // "0x7a9f..."
 * ```
 */
export class ObscuraSDK {
    private config: ObscuraConfig;
    private apiEndpoint: string;

    constructor(config: ObscuraConfig) {
        this.config = {
            timeout: 30000,
            network: 'mainnet',
            ...config,
        };

        // Set API endpoint based on network
        this.apiEndpoint = this.getApiEndpoint(this.config.network!);
    }

    private getApiEndpoint(network: string): string {
        const endpoints: Record<string, string> = {
            mainnet: 'https://api.obscura.network',
            sepolia: 'https://sepolia-api.obscura.network',
            arbitrum: 'https://arbitrum-api.obscura.network',
            optimism: 'https://optimism-api.obscura.network',
        };
        return endpoints[network] || 'http://localhost:8080';
    }

    // ============ PRICE FEEDS ============

    /**
     * Get current price for a feed
     * @param feedId Feed identifier (e.g., "ETH-USD", "BTC-USD")
     */
    async getPrice(feedId: string): Promise<PriceFeed> {
        const response = await this.fetch(`/api/feeds/${feedId}`);
        return response;
    }

    /**
     * Get multiple prices at once
     * @param feedIds Array of feed identifiers
     */
    async getPrices(feedIds: string[]): Promise<PriceFeed[]> {
        const response = await this.fetch(`/api/feeds?ids=${feedIds.join(',')}`);
        return response;
    }

    /**
     * Get all available price feeds
     */
    async listFeeds(): Promise<PriceFeed[]> {
        const response = await this.fetch('/api/feeds');
        return response;
    }

    /**
     * Get historical price data
     * @param feedId Feed identifier
     * @param from Start timestamp
     * @param to End timestamp
     */
    async getHistoricalPrices(
        feedId: string,
        from: number,
        to: number
    ): Promise<PriceFeed[]> {
        const response = await this.fetch(
            `/api/feeds/${feedId}/history?from=${from}&to=${to}`
        );
        return response;
    }

    /**
     * Subscribe to price updates (WebSocket)
     * @param feedId Feed identifier
     * @param callback Function called on each update
     */
    subscribeToPrice(
        feedId: string,
        callback: (price: PriceFeed) => void
    ): () => void {
        const ws = new WebSocket(`${this.apiEndpoint.replace('http', 'ws')}/ws/feeds/${feedId}`);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            callback(data);
        };

        // Return unsubscribe function
        return () => ws.close();
    }

    // ============ VRF (RANDOMNESS) ============

    /**
     * Request verifiable randomness
     * @param seed Seed for randomness generation
     */
    async requestRandomness(seed: string): Promise<{
        requestId: string;
        randomValue: string;
        proof: string;
    }> {
        const response = await this.fetch('/api/vrf/request', {
            method: 'POST',
            body: JSON.stringify({ seed }),
        });
        return response;
    }

    /**
     * Verify a VRF proof
     * @param proof The proof to verify
     * @param publicKey The public key used
     * @param seed The original seed
     */
    async verifyRandomness(
        proof: string,
        publicKey: string,
        seed: string
    ): Promise<boolean> {
        const response = await this.fetch('/api/vrf/verify', {
            method: 'POST',
            body: JSON.stringify({ proof, publicKey, seed }),
        });
        return response.valid;
    }

    // ============ PROOF OF RESERVE ============

    /**
     * Get reserve info for an asset
     * @param assetId Asset identifier
     */
    async getReserve(assetId: string): Promise<ReserveInfo> {
        const response = await this.fetch(`/api/reserves/${assetId}`);
        return response;
    }

    /**
     * Check if a reserve is healthy (100%+ collateralized)
     * @param assetId Asset identifier
     */
    async isReserveHealthy(assetId: string): Promise<boolean> {
        const reserve = await this.getReserve(assetId);
        return reserve.status === 'healthy';
    }

    /**
     * Get all monitored reserves
     */
    async listReserves(): Promise<ReserveInfo[]> {
        const response = await this.fetch('/api/reserves');
        return response;
    }

    // ============ CUSTOM DATA REQUESTS ============

    /**
     * Make a custom data request
     * @param url API URL to fetch data from
     * @param path JSON path to extract value
     */
    async requestData(url: string, path: string): Promise<OracleRequest> {
        const response = await this.fetch('/api/data/request', {
            method: 'POST',
            body: JSON.stringify({ url, path }),
        });
        return response;
    }

    /**
     * Get status of a data request
     * @param requestId The request ID
     */
    async getRequestStatus(requestId: string): Promise<OracleRequest> {
        const response = await this.fetch(`/api/data/request/${requestId}`);
        return response;
    }

    // ============ NETWORK INFO ============

    /**
     * Get network statistics
     */
    async getNetworkStats(): Promise<{
        totalValueSecured: string;
        activeNodes: number;
        dataPointsPerDay: number;
        uptimePercent: number;
    }> {
        const response = await this.fetch('/api/network');
        return response;
    }

    /**
     * Get list of active nodes
     */
    async getNodes(): Promise<NodeInfo[]> {
        const response = await this.fetch('/api/nodes');
        return response;
    }

    /**
     * Get chain statistics
     */
    async getChainStats(): Promise<{
        id: string;
        name: string;
        tps: string;
        height: string;
        status: string;
    }[]> {
        const response = await this.fetch('/api/chains');
        return response;
    }

    // ============ GOVERNANCE ============

    /**
     * Get active governance proposals
     */
    async getProposals(): Promise<{
        id: number;
        title: string;
        proposer: string;
        forVotes: string;
        againstVotes: string;
        status: string;
    }[]> {
        const response = await this.fetch('/api/governance/proposals');
        return response;
    }

    /**
     * Get voting power for an address
     * @param address Wallet address
     */
    async getVotingPower(address: string): Promise<string> {
        const response = await this.fetch(`/api/governance/voting-power/${address}`);
        return response.votingPower;
    }

    // ============ STAKING ============

    /**
     * Get staking info for an address
     * @param address Wallet address
     */
    async getStakeInfo(address: string): Promise<{
        stakedAmount: string;
        pendingRewards: string;
        lockEndTime: number;
        stakingAPY: number;
    }> {
        const response = await this.fetch(`/api/staking/${address}`);
        return response;
    }

    /**
     * Get current staking APY
     */
    async getStakingAPY(): Promise<number> {
        const response = await this.fetch('/api/staking/apy');
        return response.apy;
    }

    // ============ ZK PROOFS ============

    /**
     * Verify a ZK proof
     * @param proof The serialized proof
     * @param publicInputs Public inputs to the circuit
     */
    async verifyZKProof(
        proof: string,
        publicInputs: string[]
    ): Promise<boolean> {
        const response = await this.fetch('/api/zk/verify', {
            method: 'POST',
            body: JSON.stringify({ proof, publicInputs }),
        });
        return response.valid;
    }

    /**
     * Generate a range proof (value is within bounds)
     * @param value The secret value
     * @param min Minimum bound
     * @param max Maximum bound
     */
    async generateRangeProof(
        value: number,
        min: number,
        max: number
    ): Promise<{ proof: string; publicInputs: string[] }> {
        const response = await this.fetch('/api/zk/range-proof', {
            method: 'POST',
            body: JSON.stringify({ value, min, max }),
        });
        return response;
    }

    // ============ INTERNAL ============

    private async fetch(path: string, options: RequestInit = {}): Promise<any> {
        const url = `${this.apiEndpoint}${path}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Obscura API Error: ${response.status} - ${error}`);
        }

        return response.json();
    }
}

// ============ SOLIDITY INTERFACE ============

/**
 * Solidity interface for integrating Obscura in smart contracts
 * 
 * @example
 * ```solidity
 * import "@obscura/sdk/contracts/IObscuraOracle.sol";
 * 
 * contract MyDeFiProtocol {
 *     IObscuraOracle public oracle;
 *     
 *     function getETHPrice() external view returns (int256) {
 *         return oracle.latestAnswer("ETH-USD");
 *     }
 * }
 * ```
 */
export const SOLIDITY_INTERFACE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IObscuraOracle {
    // Chainlink-compatible functions
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    
    function latestAnswer() external view returns (int256);
    function latestTimestamp() external view returns (uint256);
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    
    // Obscura-specific functions
    function getZKVerifiedPrice(bytes32 feedId) external view returns (
        int256 price,
        uint256 timestamp,
        bytes memory proof
    );
    
    function requestRandomness(bytes32 seed) external returns (bytes32 requestId);
    function fulfillRandomness(bytes32 requestId) external view returns (uint256 randomValue);
    
    function getReserveRatio(bytes32 assetId) external view returns (uint256 ratio);
    function isReserveHealthy(bytes32 assetId) external view returns (bool);
}
`;

// Export default instance for quick usage
export default ObscuraSDK;
