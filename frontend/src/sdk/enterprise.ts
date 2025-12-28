/**
 * Obscura Enterprise Frontend SDK
 * Complete integration layer between React frontend and Go backend
 * 
 * Features:
 * - Real-time WebSocket subscriptions
 * - REST API integration
 * - React hooks for easy data binding
 * - TypeScript types for all data models
 */

// ============================================================================
// Types
// ============================================================================

export interface ChainStats {
    id: string;
    name: string;
    tps: string;
    height: string;
    status: 'Optimal' | 'Congested' | 'Degraded';
    latency: string;
}

export interface FeedData {
    name: string;
    price: string;
    status: 'Verified' | 'Pending' | 'Obscured';
    trend: number;
    roundId?: number;
    decimals?: number;
    isZKVerified?: boolean;
    timestamp?: number;
}

export interface JobRecord {
    id: string;
    type: 'Price Feed' | 'VRF Request' | 'Compute';
    target: string;
    status: 'Fulfilled' | 'Pending' | 'Failed';
    hash: string;
    roundId?: number;
    timestamp: string;
}

export interface NodeMetrics {
    requests_processed: number;
    proofs_generated: number;
    transactions_sent: number;
    transactions_failed: number;
    aggregations_completed: number;
    outliers_detected: number;
    oev_recaptured: number;
    uptime_seconds: number;
    last_request_timestamp: number;
    total_staked: number;
}

export interface NetworkInfo {
    total_value_secured: number;
    active_nodes: number;
    data_points_per_day: number;
    uptime_percent: number;
    total_staked: number;
    oev_recaptured: number;
    oev_recaptured_eth: number;
    last_auction_winner: string;
    auction_frequency_ms: number;
    security_status: string;
    oev_potential: string;
}

export interface Proposal {
    id: number;
    title: string;
    description?: string;
    proposer?: string;
    votes_for: number;
    votes_against: number;
    status: 'Active' | 'Passed' | 'Rejected' | 'Ending Soon';
    endTime?: string;
}

export interface VRFResult {
    requestId: string;
    randomValue: string;
    proof: string;
    timestamp: string;
}

export interface ZKProofResult {
    valid: boolean;
    proofHash?: string;
    verificationTime?: number;
}

export interface PriceHistory {
    time: string;
    price: number;
}

export type SubscriptionCallback<T> = (data: T) => void;

// ============================================================================
// WebSocket Manager (for real-time push updates)
// ============================================================================

export class WebSocketManager {
    private ws: WebSocket | null = null;
    private endpoint: string;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 1000;
    private subscriptions: Map<string, Set<SubscriptionCallback<any>>> = new Map();
    private isConnecting: boolean = false;

    constructor(endpoint: string = 'ws://localhost:8080/ws') {
        this.endpoint = endpoint;
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            if (this.isConnecting) {
                // Wait for existing connection
                setTimeout(() => resolve(), 100);
                return;
            }

            this.isConnecting = true;

            try {
                this.ws = new WebSocket(this.endpoint);

                this.ws.onopen = () => {
                    console.log('[Obscura WS] Connected');
                    this.reconnectAttempts = 0;
                    this.isConnecting = false;
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (err) {
                        console.error('[Obscura WS] Parse error:', err);
                    }
                };

                this.ws.onclose = () => {
                    console.log('[Obscura WS] Disconnected');
                    this.isConnecting = false;
                    this.attemptReconnect();
                };

                this.ws.onerror = (error) => {
                    console.error('[Obscura WS] Error:', error);
                    this.isConnecting = false;
                    reject(error);
                };
            } catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }

    private handleMessage(data: any) {
        const { type, payload } = data;
        const callbacks = this.subscriptions.get(type);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(payload);
                } catch (err) {
                    console.error('[Obscura WS] Callback error:', err);
                }
            });
        }
    }

    private attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[Obscura WS] Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`[Obscura WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            this.connect().catch(() => { });
        }, delay);
    }

    subscribe<T>(type: string, callback: SubscriptionCallback<T>): () => void {
        if (!this.subscriptions.has(type)) {
            this.subscriptions.set(type, new Set());
        }
        this.subscriptions.get(type)!.add(callback);

        // Send subscription message if connected
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ action: 'subscribe', type }));
        }

        return () => {
            this.subscriptions.get(type)?.delete(callback);
            if (this.subscriptions.get(type)?.size === 0) {
                this.subscriptions.delete(type);
                if (this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ action: 'unsubscribe', type }));
                }
            }
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// ============================================================================
// Main SDK Client
// ============================================================================

export class ObscuraEnterpriseSDK {
    private apiEndpoint: string;
    private wsManager: WebSocketManager;
    private pollIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

    constructor(options: {
        apiEndpoint?: string;
        wsEndpoint?: string;
    } = {}) {
        this.apiEndpoint = options.apiEndpoint || 'http://localhost:8080';
        this.wsManager = new WebSocketManager(options.wsEndpoint || 'ws://localhost:8080/ws');
    }

    // ============================================================================
    // Core API Methods
    // ============================================================================

    /**
     * Fetch network-wide statistics
     */
    async getNetworkStats(): Promise<NodeMetrics> {
        const response = await this.fetch('/api/stats');
        return response;
    }

    /**
     * Fetch all price feeds
     */
    async getFeeds(): Promise<FeedData[]> {
        const response = await this.fetch('/api/feeds');
        return Array.isArray(response) ? response : [];
    }

    /**
     * Fetch specific feed by ID
     */
    async getFeed(feedId: string): Promise<FeedData | null> {
        const feeds = await this.getFeeds();
        return feeds.find(f => f.name === feedId || f.name.replace(' / ', '-') === feedId) || null;
    }

    /**
     * Fetch recent job history
     */
    async getRecentJobs(): Promise<JobRecord[]> {
        const response = await this.fetch('/api/jobs');
        return Array.isArray(response) ? response : [];
    }

    /**
     * Fetch governance proposals
     */
    async getProposals(): Promise<Proposal[]> {
        const response = await this.fetch('/api/proposals');
        return Array.isArray(response) ? response : [];
    }

    /**
     * Fetch network info (TVS, active nodes, etc.)
     */
    async getNetworkInfo(): Promise<NetworkInfo> {
        const response = await this.fetch('/api/network');
        return response;
    }

    /**
     * Fetch blockchain chain stats
     */
    async getChainStats(): Promise<ChainStats[]> {
        const response = await this.fetch('/api/chains');
        return Array.isArray(response) ? response : [];
    }

    /**
     * Check node health
     */
    async checkHealth(): Promise<{ status: string; timestamp: number }> {
        const response = await this.fetch('/health');
        return response;
    }

    // ============================================================================
    // VRF (Randomness)
    // ============================================================================

    /**
     * Request verifiable randomness
     */
    async requestRandomness(seed: string): Promise<VRFResult> {
        const response = await this.fetch('/api/vrf/request', {
            method: 'POST',
            body: JSON.stringify({ seed }),
        });
        return response;
    }

    /**
     * Verify a VRF proof
     */
    async verifyRandomness(proof: string, publicKey: string, seed: string): Promise<boolean> {
        const response = await this.fetch('/api/vrf/verify', {
            method: 'POST',
            body: JSON.stringify({ proof, publicKey, seed }),
        });
        return response.valid;
    }

    // ============================================================================
    // ZK Proofs
    // ============================================================================

    /**
     * Verify a ZK proof
     */
    async verifyZKProof(proof: string, publicInputs: string[]): Promise<ZKProofResult> {
        const response = await this.fetch('/api/zk/verify', {
            method: 'POST',
            body: JSON.stringify({ proof, publicInputs }),
        });
        return response;
    }

    /**
     * Generate a range proof
     */
    async generateRangeProof(value: number, min: number, max: number): Promise<{
        proof: string;
        publicInputs: string[];
    }> {
        const response = await this.fetch('/api/zk/range-proof', {
            method: 'POST',
            body: JSON.stringify({ value, min, max }),
        });
        return response;
    }

    // ============================================================================
    // Real-time Polling (alternative to WebSocket)
    // ============================================================================

    /**
     * Start polling for data updates
     */
    startPolling<T>(
        key: string,
        fetcher: () => Promise<T>,
        callback: (data: T) => void,
        intervalMs: number = 5000
    ): () => void {
        // Initial fetch
        fetcher().then(callback).catch(console.error);

        // Set up interval
        const intervalId = setInterval(() => {
            fetcher().then(callback).catch(console.error);
        }, intervalMs);

        this.pollIntervals.set(key, intervalId);

        // Return cleanup function
        return () => {
            const id = this.pollIntervals.get(key);
            if (id) {
                clearInterval(id);
                this.pollIntervals.delete(key);
            }
        };
    }

    /**
     * Stop all polling
     */
    stopAllPolling() {
        this.pollIntervals.forEach((intervalId) => {
            clearInterval(intervalId);
        });
        this.pollIntervals.clear();
    }

    // ============================================================================
    // WebSocket Methods
    // ============================================================================

    /**
     * Connect to WebSocket server
     */
    async connectWebSocket(): Promise<void> {
        return this.wsManager.connect();
    }

    /**
     * Subscribe to real-time price updates
     */
    subscribeToPrices(callback: SubscriptionCallback<FeedData[]>): () => void {
        return this.wsManager.subscribe('prices', callback);
    }

    /**
     * Subscribe to job updates
     */
    subscribeToJobs(callback: SubscriptionCallback<JobRecord>): () => void {
        return this.wsManager.subscribe('job', callback);
    }

    /**
     * Subscribe to network metrics
     */
    subscribeToMetrics(callback: SubscriptionCallback<NodeMetrics>): () => void {
        return this.wsManager.subscribe('metrics', callback);
    }

    /**
     * Disconnect WebSocket
     */
    disconnectWebSocket() {
        this.wsManager.disconnect();
    }

    // ============================================================================
    // Internal
    // ============================================================================

    private async fetch(path: string, options: RequestInit = {}): Promise<any> {
        const url = `${this.apiEndpoint}${path}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            return response.json();
        } catch (error) {
            console.error(`[Obscura SDK] Fetch error for ${path}:`, error);
            throw error;
        }
    }
}

// ============================================================================
// React Hooks
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

// Singleton SDK instance
let sdkInstance: ObscuraEnterpriseSDK | null = null;

export function initializeSDK(options?: { apiEndpoint?: string; wsEndpoint?: string }) {
    sdkInstance = new ObscuraEnterpriseSDK(options);
    return sdkInstance;
}

export function getSDK(): ObscuraEnterpriseSDK {
    if (!sdkInstance) {
        sdkInstance = new ObscuraEnterpriseSDK();
    }
    return sdkInstance;
}

/**
 * Hook for fetching network metrics
 */
export function useNetworkStats(pollInterval: number = 5000) {
    const [data, setData] = useState<NodeMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const sdk = getSDK();

    useEffect(() => {
        const cleanup = sdk.startPolling(
            'networkStats',
            () => sdk.getNetworkStats(),
            (result) => {
                setData(result);
                setLoading(false);
                setError(null);
            },
            pollInterval
        );

        return cleanup;
    }, [pollInterval]);

    return { data, loading, error };
}

/**
 * Hook for fetching price feeds
 */
export function useFeeds(pollInterval: number = 5000) {
    const [data, setData] = useState<FeedData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const sdk = getSDK();

    useEffect(() => {
        const cleanup = sdk.startPolling(
            'feeds',
            () => sdk.getFeeds(),
            (result) => {
                setData(result);
                setLoading(false);
                setError(null);
            },
            pollInterval
        );

        return cleanup;
    }, [pollInterval]);

    return { data, loading, error };
}

/**
 * Hook for fetching job history
 */
export function useRecentJobs(pollInterval: number = 5000) {
    const [data, setData] = useState<JobRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const sdk = getSDK();

    useEffect(() => {
        const cleanup = sdk.startPolling(
            'jobs',
            () => sdk.getRecentJobs(),
            (result) => {
                setData(result);
                setLoading(false);
                setError(null);
            },
            pollInterval
        );

        return cleanup;
    }, [pollInterval]);

    return { data, loading, error };
}

/**
 * Hook for fetching chain statistics
 */
export function useChainStats(pollInterval: number = 5000) {
    const [data, setData] = useState<ChainStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const sdk = getSDK();

    useEffect(() => {
        const cleanup = sdk.startPolling(
            'chains',
            () => sdk.getChainStats(),
            (result) => {
                setData(result);
                setLoading(false);
                setError(null);
            },
            pollInterval
        );

        return cleanup;
    }, [pollInterval]);

    return { data, loading, error };
}

/**
 * Hook for fetching network info
 */
export function useNetworkInfo(pollInterval: number = 5000) {
    const [data, setData] = useState<NetworkInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const sdk = getSDK();

    useEffect(() => {
        const cleanup = sdk.startPolling(
            'networkInfo',
            () => sdk.getNetworkInfo(),
            (result) => {
                setData(result);
                setLoading(false);
                setError(null);
            },
            pollInterval
        );

        return cleanup;
    }, [pollInterval]);

    return { data, loading, error };
}

/**
 * Hook for fetching governance proposals
 */
export function useProposals(pollInterval: number = 30000) {
    const [data, setData] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const sdk = getSDK();

    useEffect(() => {
        const cleanup = sdk.startPolling(
            'proposals',
            () => sdk.getProposals(),
            (result) => {
                setData(result);
                setLoading(false);
                setError(null);
            },
            pollInterval
        );

        return cleanup;
    }, [pollInterval]);

    return { data, loading, error };
}

/**
 * Hook for VRF randomness
 */
export function useVRF() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<VRFResult | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const sdk = getSDK();

    const requestRandomness = useCallback(async (seed: string) => {
        setLoading(true);
        setError(null);
        try {
            const vrfResult = await sdk.requestRandomness(seed);
            setResult(vrfResult);
            return vrfResult;
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { requestRandomness, result, loading, error };
}

/**
 * Hook for checking node health
 */
export function useHealth(pollInterval: number = 10000) {
    const [isHealthy, setIsHealthy] = useState(true);
    const [lastCheck, setLastCheck] = useState<number>(Date.now());
    const sdk = getSDK();

    useEffect(() => {
        const check = async () => {
            try {
                await sdk.checkHealth();
                setIsHealthy(true);
            } catch {
                setIsHealthy(false);
            }
            setLastCheck(Date.now());
        };

        check();
        const id = setInterval(check, pollInterval);
        return () => clearInterval(id);
    }, [pollInterval]);

    return { isHealthy, lastCheck };
}

// Export default SDK instance for direct usage
export default ObscuraEnterpriseSDK;
