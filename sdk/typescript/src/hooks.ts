/**
 * React Hooks for Obscura Oracle
 * Provides easy integration with React applications
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ObscuraClient, createClient } from './client';
import {
    ClientConfig,
    PriceData,
    GetPriceOptions,
    PriceUpdateEvent,
    SubscriptionOptions,
    FeedMetadata,
    OracleStats,
    VRFResult,
    VRFRequest,
} from './types';

// Context for sharing client across components
let sharedClient: ObscuraClient | null = null;

/**
 * Initialize the shared Obscura client
 * Call this once at app startup
 */
export function initObscura(config: ClientConfig): ObscuraClient {
    if (sharedClient) {
        sharedClient.destroy();
    }
    sharedClient = createClient(config);
    return sharedClient;
}

/**
 * Get the shared Obscura client instance
 */
export function getObscuraClient(): ObscuraClient {
    if (!sharedClient) {
        throw new Error('Obscura not initialized. Call initObscura() first.');
    }
    return sharedClient;
}

/**
 * Hook to get the Obscura client instance
 */
export function useObscuraClient(): ObscuraClient {
    return getObscuraClient();
}

/**
 * Hook state for loading/error handling
 */
interface QueryState<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * Hook to fetch and subscribe to a price feed
 * 
 * @example
 * ```tsx
 * function PriceDisplay() {
 *   const { data, loading, error } = usePrice('ETH/USD', { proof: true });
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   
 *   return <div>ETH/USD: {data?.value}</div>;
 * }
 * ```
 */
export function usePrice(feedId: string, options: GetPriceOptions = {}): QueryState<PriceData> {
    const [data, setData] = useState<PriceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const client = useObscuraClient();

    const fetchPrice = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const price = await client.getPrice(feedId, options);
            setData(price);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setLoading(false);
        }
    }, [client, feedId, JSON.stringify(options)]);

    useEffect(() => {
        fetchPrice();
    }, [fetchPrice]);

    return { data, loading, error, refetch: fetchPrice };
}

/**
 * Hook to subscribe to real-time price updates
 * 
 * @example
 * ```tsx
 * function LivePrice() {
 *   const { price, isConnected, error } = usePriceStream('ETH/USD');
 *   
 *   return (
 *     <div>
 *       {isConnected ? '🟢' : '🔴'} ETH/USD: {price?.value || 'Loading...'}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePriceStream(
    feedId: string,
    options: SubscriptionOptions = {}
): {
    price: PriceUpdateEvent | null;
    isConnected: boolean;
    error: Error | null;
} {
    const [price, setPrice] = useState<PriceUpdateEvent | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const client = useObscuraClient();

    useEffect(() => {
        setIsConnected(true);

        const unsubscribe = client.subscribe(
            feedId,
            (update) => {
                setPrice(update);
                setError(null);
            },
            options
        );

        client.setErrorHandler((err) => {
            setError(err);
            setIsConnected(false);
        });

        return () => {
            unsubscribe();
        };
    }, [client, feedId, JSON.stringify(options)]);

    return { price, isConnected, error };
}

/**
 * Hook to subscribe to multiple price feeds
 */
export function usePriceStreams(
    feedIds: string[],
    options: SubscriptionOptions = {}
): {
    prices: Map<string, PriceUpdateEvent>;
    isConnected: boolean;
    error: Error | null;
} {
    const [prices, setPrices] = useState<Map<string, PriceUpdateEvent>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const client = useObscuraClient();

    useEffect(() => {
        setIsConnected(true);

        const unsubscribe = client.subscribeMultiple(
            feedIds,
            (update) => {
                setPrices(prev => new Map(prev).set(update.feedId, update));
                setError(null);
            },
            options
        );

        client.setErrorHandler((err) => {
            setError(err);
            setIsConnected(false);
        });

        return () => {
            unsubscribe();
        };
    }, [client, feedIds.join(','), JSON.stringify(options)]);

    return { prices, isConnected, error };
}

/**
 * Hook to get multiple prices at once
 */
export function usePrices(
    feedIds: string[],
    options: GetPriceOptions = {}
): QueryState<Map<string, PriceData>> {
    const [data, setData] = useState<Map<string, PriceData> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const client = useObscuraClient();

    const fetchPrices = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const prices = await client.getPrices(feedIds, options);
            setData(prices);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setLoading(false);
        }
    }, [client, feedIds.join(','), JSON.stringify(options)]);

    useEffect(() => {
        fetchPrices();
    }, [fetchPrices]);

    return { data, loading, error, refetch: fetchPrices };
}

/**
 * Hook to request VRF randomness
 * 
 * @example
 * ```tsx
 * function RandomButton() {
 *   const { requestRandomness, result, loading, error } = useVRF();
 *   
 *   return (
 *     <button onClick={() => requestRandomness({ seed: 'my-seed' })}>
 *       {loading ? 'Generating...' : `Random: ${result?.randomWords[0] || 'Click to generate'}`}
 *     </button>
 *   );
 * }
 * ```
 */
export function useVRF(): {
    requestRandomness: (request: VRFRequest) => Promise<VRFResult>;
    result: VRFResult | null;
    loading: boolean;
    error: Error | null;
} {
    const [result, setResult] = useState<VRFResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const client = useObscuraClient();

    const requestRandomness = useCallback(async (request: VRFRequest) => {
        setLoading(true);
        setError(null);
        try {
            const vrfResult = await client.requestRandomness(request);
            setResult(vrfResult);
            return vrfResult;
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [client]);

    return { requestRandomness, result, loading, error };
}

/**
 * Hook to get feed metadata
 */
export function useFeedMetadata(feedId: string): QueryState<FeedMetadata> {
    const [data, setData] = useState<FeedMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const client = useObscuraClient();

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const metadata = await client.getFeedMetadata(feedId);
            setData(metadata);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setLoading(false);
        }
    }, [client, feedId]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { data, loading, error, refetch: fetch };
}

/**
 * Hook to get all available feeds
 */
export function useFeeds(): QueryState<FeedMetadata[]> {
    const [data, setData] = useState<FeedMetadata[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const client = useObscuraClient();

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const feeds = await client.getAllFeeds();
            setData(feeds);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setLoading(false);
        }
    }, [client]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { data, loading, error, refetch: fetch };
}

/**
 * Hook to get oracle network statistics
 */
export function useOracleStats(): QueryState<OracleStats> {
    const [data, setData] = useState<OracleStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const client = useObscuraClient();

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const stats = await client.getStats();
            setData(stats);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setLoading(false);
        }
    }, [client]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { data, loading, error, refetch: fetch };
}

/**
 * Hook for debounced price updates (useful for high-frequency feeds)
 */
export function useDebouncedPrice(
    feedId: string,
    debounceMs: number = 100
): {
    price: PriceUpdateEvent | null;
    isConnected: boolean;
} {
    const [price, setPrice] = useState<PriceUpdateEvent | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const client = useObscuraClient();
    const lastUpdateRef = useRef<number>(0);

    useEffect(() => {
        setIsConnected(true);

        const unsubscribe = client.subscribe(feedId, (update) => {
            const now = Date.now();
            if (now - lastUpdateRef.current >= debounceMs) {
                setPrice(update);
                lastUpdateRef.current = now;
            }
        });

        return () => {
            unsubscribe();
        };
    }, [client, feedId, debounceMs]);

    return { price, isConnected };
}

/**
 * Hook to format price with proper decimals
 */
export function useFormattedPrice(
    feedId: string,
    options: {
        locale?: string;
        currency?: string;
        minimumFractionDigits?: number;
        maximumFractionDigits?: number;
    } = {}
): {
    formatted: string;
    raw: PriceData | null;
    loading: boolean;
    error: Error | null;
} {
    const { data, loading, error, refetch } = usePrice(feedId);

    const formatted = useMemo(() => {
        if (!data) return '--';

        const value = parseFloat(data.value) / Math.pow(10, data.decimals);
        return new Intl.NumberFormat(options.locale || 'en-US', {
            style: options.currency ? 'currency' : 'decimal',
            currency: options.currency,
            minimumFractionDigits: options.minimumFractionDigits ?? 2,
            maximumFractionDigits: options.maximumFractionDigits ?? 2,
        }).format(value);
    }, [data, options]);

    return { formatted, raw: data, loading, error };
}
