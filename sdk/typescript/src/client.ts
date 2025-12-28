/**
 * Obscura Oracle Client
 * Main client for interacting with Obscura oracle network
 */

import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import {
    ClientConfig,
    PriceData,
    GetPriceOptions,
    VRFRequest,
    VRFResult,
    SubscriptionOptions,
    PriceUpdateCallback,
    ErrorCallback,
    FeedMetadata,
    OracleStats,
    SupportedChain,
    DEFAULT_RPC_URLS,
    CHAIN_IDS,
} from './types';

/**
 * Main client for interacting with Obscura Oracle
 * 
 * @example
 * ```typescript
 * const client = new ObscuraClient({
 *   chain: 'base',
 *   apiKey: 'your-api-key'
 * });
 * 
 * const price = await client.getPrice('ETH/USD', { proof: true });
 * console.log(`ETH/USD: ${price.value}`);
 * ```
 */
export class ObscuraClient {
    private config: Required<ClientConfig>;
    private http: AxiosInstance;
    private ws: WebSocket | null = null;
    private subscriptions: Map<string, Set<PriceUpdateCallback>> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private onError: ErrorCallback | null = null;

    /**
     * Create a new Obscura client
     * @param config - Client configuration
     */
    constructor(config: ClientConfig) {
        this.config = {
            chain: config.chain,
            apiKey: config.apiKey || '',
            rpcUrl: config.rpcUrl || DEFAULT_RPC_URLS[config.chain] || '',
            wsUrl: config.wsUrl || this.getDefaultWsUrl(config.chain),
            apiEndpoint: config.apiEndpoint || 'https://api.obscura.network',
            debug: config.debug || false,
            timeout: config.timeout || 30000,
        };

        this.http = axios.create({
            baseURL: this.config.apiEndpoint,
            timeout: this.config.timeout,
            headers: {
                'X-API-Key': this.config.apiKey,
                'Content-Type': 'application/json',
            },
        });

        if (this.config.debug) {
            console.log('[Obscura] Client initialized', { chain: this.config.chain });
        }
    }

    /**
     * Get the price for a feed
     * @param feedId - Feed identifier (e.g., 'ETH/USD')
     * @param options - Query options
     * @returns Price data with optional proof
     */
    async getPrice(feedId: string, options: GetPriceOptions = {}): Promise<PriceData> {
        const params = new URLSearchParams();
        params.set('chain', this.config.chain);

        if (options.proof) params.set('proof', 'true');
        if (options.merkleProof) params.set('merkleProof', 'true');
        if (options.maxAge) params.set('maxAge', options.maxAge.toString());
        if (options.forceRefresh) params.set('refresh', 'true');

        try {
            const response = await this.http.get(`/v1/prices/${encodeURIComponent(feedId)}?${params}`);
            return this.parsePriceResponse(response.data);
        } catch (error) {
            this.handleError('getPrice', error);
            throw error;
        }
    }

    /**
     * Get prices for multiple feeds
     * @param feedIds - Array of feed identifiers
     * @param options - Query options
     * @returns Map of feed ID to price data
     */
    async getPrices(feedIds: string[], options: GetPriceOptions = {}): Promise<Map<string, PriceData>> {
        const params = new URLSearchParams();
        params.set('chain', this.config.chain);
        params.set('feeds', feedIds.join(','));

        if (options.proof) params.set('proof', 'true');
        if (options.maxAge) params.set('maxAge', options.maxAge.toString());

        try {
            const response = await this.http.get(`/v1/prices/batch?${params}`);
            const result = new Map<string, PriceData>();

            for (const item of response.data.prices) {
                result.set(item.feedId, this.parsePriceResponse(item));
            }

            return result;
        } catch (error) {
            this.handleError('getPrices', error);
            throw error;
        }
    }

    /**
     * Get the latest round data (Chainlink-compatible interface)
     * @param feedId - Feed identifier
     * @returns Round data compatible with Chainlink AggregatorV3Interface
     */
    async latestRoundData(feedId: string): Promise<{
        roundId: bigint;
        answer: bigint;
        startedAt: bigint;
        updatedAt: bigint;
        answeredInRound: bigint;
    }> {
        const price = await this.getPrice(feedId);

        return {
            roundId: price.roundId,
            answer: BigInt(price.value),
            startedAt: BigInt(Math.floor(price.timestamp.getTime() / 1000)),
            updatedAt: BigInt(Math.floor(price.timestamp.getTime() / 1000)),
            answeredInRound: price.roundId,
        };
    }

    /**
     * Request verifiable randomness (VRF)
     * @param request - VRF request parameters
     * @returns VRF result with proof
     */
    async requestRandomness(request: VRFRequest): Promise<VRFResult> {
        try {
            const response = await this.http.post('/v1/vrf/request', {
                chain: this.config.chain,
                seed: request.seed,
                numWords: request.numWords || 1,
                callbackGasLimit: request.callbackGasLimit || 100000,
            });

            return {
                requestId: response.data.requestId,
                randomWords: response.data.randomWords,
                proof: response.data.proof,
                timestamp: new Date(response.data.timestamp),
            };
        } catch (error) {
            this.handleError('requestRandomness', error);
            throw error;
        }
    }

    /**
     * Subscribe to real-time price updates via WebSocket
     * @param feedId - Feed identifier to subscribe to
     * @param callback - Callback for price updates
     * @param options - Subscription options
     * @returns Unsubscribe function
     */
    subscribe(
        feedId: string,
        callback: PriceUpdateCallback,
        options: SubscriptionOptions = {}
    ): () => void {
        // Ensure WebSocket is connected
        this.ensureWebSocketConnected();

        // Add to subscriptions
        if (!this.subscriptions.has(feedId)) {
            this.subscriptions.set(feedId, new Set());

            // Send subscribe message
            this.sendWebSocketMessage({
                action: 'subscribe',
                feed_ids: [feedId],
                options,
            });
        }

        this.subscriptions.get(feedId)!.add(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.subscriptions.get(feedId);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this.subscriptions.delete(feedId);
                    this.sendWebSocketMessage({
                        action: 'unsubscribe',
                        feed_ids: [feedId],
                    });
                }
            }
        };
    }

    /**
     * Subscribe to multiple feeds
     * @param feedIds - Array of feed identifiers
     * @param callback - Callback for price updates
     * @param options - Subscription options
     * @returns Unsubscribe function
     */
    subscribeMultiple(
        feedIds: string[],
        callback: PriceUpdateCallback,
        options: SubscriptionOptions = {}
    ): () => void {
        const unsubscribes = feedIds.map(feedId =>
            this.subscribe(feedId, callback, options)
        );

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }

    /**
     * Get metadata for a feed
     * @param feedId - Feed identifier
     * @returns Feed metadata
     */
    async getFeedMetadata(feedId: string): Promise<FeedMetadata> {
        try {
            const response = await this.http.get(`/v1/feeds/${encodeURIComponent(feedId)}`);
            return response.data;
        } catch (error) {
            this.handleError('getFeedMetadata', error);
            throw error;
        }
    }

    /**
     * Get all available feeds
     * @returns Array of feed metadata
     */
    async getAllFeeds(): Promise<FeedMetadata[]> {
        try {
            const response = await this.http.get('/v1/feeds', {
                params: { chain: this.config.chain },
            });
            return response.data.feeds;
        } catch (error) {
            this.handleError('getAllFeeds', error);
            throw error;
        }
    }

    /**
     * Get oracle network statistics
     * @returns Network stats
     */
    async getStats(): Promise<OracleStats> {
        try {
            const response = await this.http.get('/v1/stats');
            return response.data;
        } catch (error) {
            this.handleError('getStats', error);
            throw error;
        }
    }

    /**
     * Set error callback for global error handling
     * @param callback - Error callback function
     */
    setErrorHandler(callback: ErrorCallback): void {
        this.onError = callback;
    }

    /**
     * Close all connections and cleanup
     */
    destroy(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.subscriptions.clear();
    }

    /**
     * Get the chain ID for the configured chain
     */
    get chainId(): number {
        return CHAIN_IDS[this.config.chain];
    }

    // Private methods

    private getDefaultWsUrl(chain: SupportedChain): string {
        // Return default WebSocket URL based on chain
        return `wss://ws.obscura.network/v1/${chain}`;
    }

    private ensureWebSocketConnected(): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        this.ws = new WebSocket(this.config.wsUrl, {
            headers: {
                'X-API-Key': this.config.apiKey,
            },
        });

        this.ws.on('open', () => {
            if (this.config.debug) {
                console.log('[Obscura] WebSocket connected');
            }
            this.reconnectAttempts = 0;

            // Resubscribe to all feeds
            if (this.subscriptions.size > 0) {
                this.sendWebSocketMessage({
                    action: 'subscribe',
                    feed_ids: Array.from(this.subscriptions.keys()),
                });
            }
        });

        this.ws.on('message', (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleWebSocketMessage(message);
            } catch (error) {
                if (this.config.debug) {
                    console.error('[Obscura] Failed to parse WebSocket message', error);
                }
            }
        });

        this.ws.on('close', () => {
            if (this.config.debug) {
                console.log('[Obscura] WebSocket closed');
            }
            this.attemptReconnect();
        });

        this.ws.on('error', (error) => {
            if (this.config.debug) {
                console.error('[Obscura] WebSocket error', error);
            }
            if (this.onError) {
                this.onError(error);
            }
        });
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            if (this.config.debug) {
                console.error('[Obscura] Max reconnect attempts reached');
            }
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        if (this.config.debug) {
            console.log(`[Obscura] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        }

        setTimeout(() => {
            this.ensureWebSocketConnected();
        }, delay);
    }

    private sendWebSocketMessage(message: object): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    private handleWebSocketMessage(message: any): void {
        if (message.feed_id) {
            const callbacks = this.subscriptions.get(message.feed_id);
            if (callbacks) {
                const update = {
                    feedId: message.feed_id,
                    value: message.value,
                    decimals: message.decimals,
                    roundId: BigInt(message.round_id),
                    timestamp: new Date(message.timestamp),
                    latencyMs: message.latency_ms,
                    confidence: message.confidence,
                };

                callbacks.forEach(callback => {
                    try {
                        callback(update);
                    } catch (error) {
                        if (this.config.debug) {
                            console.error('[Obscura] Callback error', error);
                        }
                    }
                });
            }
        }
    }

    private parsePriceResponse(data: any): PriceData {
        return {
            feedId: data.feedId || data.feed_id,
            value: data.value,
            decimals: data.decimals,
            roundId: BigInt(data.roundId || data.round_id),
            timestamp: new Date(data.timestamp),
            zkVerified: data.zkVerified || data.zk_verified || false,
            confidence: data.confidence || 100,
            proof: data.proof,
            merkleProof: data.merkleProof || data.merkle_proof,
        };
    }

    private handleError(method: string, error: any): void {
        if (this.config.debug) {
            console.error(`[Obscura] ${method} error:`, error);
        }
        if (this.onError) {
            this.onError(error instanceof Error ? error : new Error(String(error)));
        }
    }
}

/**
 * Create a new Obscura client with the given configuration
 * @param config - Client configuration
 * @returns Configured ObscuraClient instance
 */
export function createClient(config: ClientConfig): ObscuraClient {
    return new ObscuraClient(config);
}
