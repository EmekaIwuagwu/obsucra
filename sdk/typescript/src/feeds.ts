/**
 * Price Feed utilities and helpers
 */

import { FeedMetadata, SupportedChain } from './types';

/**
 * Known price feed identifiers
 */
export const FEEDS = {
    // Crypto
    ETH_USD: 'ETH/USD',
    BTC_USD: 'BTC/USD',
    SOL_USD: 'SOL/USD',
    MATIC_USD: 'MATIC/USD',
    AVAX_USD: 'AVAX/USD',
    BNB_USD: 'BNB/USD',
    ARB_USD: 'ARB/USD',
    OP_USD: 'OP/USD',
    LINK_USD: 'LINK/USD',
    UNI_USD: 'UNI/USD',
    AAVE_USD: 'AAVE/USD',

    // Stablecoins
    USDC_USD: 'USDC/USD',
    USDT_USD: 'USDT/USD',
    DAI_USD: 'DAI/USD',
    FRAX_USD: 'FRAX/USD',

    // Forex
    EUR_USD: 'EUR/USD',
    GBP_USD: 'GBP/USD',
    JPY_USD: 'JPY/USD',
    CHF_USD: 'CHF/USD',

    // Commodities
    XAU_USD: 'XAU/USD', // Gold
    XAG_USD: 'XAG/USD', // Silver
    WTI_USD: 'WTI/USD', // Oil

    // Real World Assets (RWA)
    TBILL_3M: 'TBILL/3M',
    TBILL_6M: 'TBILL/6M',
    TBILL_1Y: 'TBILL/1Y',
    SOFR: 'SOFR/USD',
    TERM_SOFR_1M: 'TERM_SOFR/1M',
    TERM_SOFR_3M: 'TERM_SOFR/3M',
} as const;

export type FeedId = typeof FEEDS[keyof typeof FEEDS];

/**
 * Feed category information
 */
export const FEED_CATEGORIES = {
    crypto: {
        name: 'Cryptocurrency',
        description: 'Major cryptocurrency prices',
        feeds: [
            FEEDS.ETH_USD,
            FEEDS.BTC_USD,
            FEEDS.SOL_USD,
            FEEDS.MATIC_USD,
            FEEDS.AVAX_USD,
            FEEDS.BNB_USD,
        ],
    },
    stablecoin: {
        name: 'Stablecoins',
        description: 'Stablecoin peg monitoring',
        feeds: [
            FEEDS.USDC_USD,
            FEEDS.USDT_USD,
            FEEDS.DAI_USD,
            FEEDS.FRAX_USD,
        ],
    },
    forex: {
        name: 'Forex',
        description: 'Foreign exchange rates',
        feeds: [
            FEEDS.EUR_USD,
            FEEDS.GBP_USD,
            FEEDS.JPY_USD,
        ],
    },
    commodities: {
        name: 'Commodities',
        description: 'Precious metals and energy',
        feeds: [
            FEEDS.XAU_USD,
            FEEDS.XAG_USD,
            FEEDS.WTI_USD,
        ],
    },
    rwa: {
        name: 'Real World Assets',
        description: 'Treasury rates and traditional finance',
        feeds: [
            FEEDS.TBILL_3M,
            FEEDS.SOFR,
            FEEDS.TERM_SOFR_1M,
            FEEDS.TERM_SOFR_3M,
        ],
    },
};

/**
 * Default feed configurations
 */
export const FEED_CONFIGS: Record<string, Partial<FeedMetadata>> = {
    [FEEDS.ETH_USD]: {
        name: 'Ethereum / USD',
        category: 'crypto',
        decimals: 8,
        heartbeat: 3600, // 1 hour
        deviationThreshold: 0.5,
        zkEnabled: true,
    },
    [FEEDS.BTC_USD]: {
        name: 'Bitcoin / USD',
        category: 'crypto',
        decimals: 8,
        heartbeat: 3600,
        deviationThreshold: 0.5,
        zkEnabled: true,
    },
    [FEEDS.SOFR]: {
        name: 'Secured Overnight Financing Rate',
        category: 'rwa',
        decimals: 6,
        heartbeat: 86400, // Daily
        deviationThreshold: 0.01,
        zkEnabled: true,
    },
};

/**
 * Parse a price value with decimals
 * @param value - Raw value from oracle
 * @param decimals - Number of decimals
 * @returns Parsed number
 */
export function parsePrice(value: string | bigint, decimals: number = 8): number {
    const bigValue = typeof value === 'string' ? BigInt(value) : value;
    return Number(bigValue) / Math.pow(10, decimals);
}

/**
 * Format a price for display
 * @param value - Raw value from oracle
 * @param decimals - Number of decimals
 * @param options - Formatting options
 */
export function formatPrice(
    value: string | bigint,
    decimals: number = 8,
    options: {
        locale?: string;
        currency?: string;
        minimumFractionDigits?: number;
        maximumFractionDigits?: number;
    } = {}
): string {
    const parsed = parsePrice(value, decimals);

    return new Intl.NumberFormat(options.locale || 'en-US', {
        style: options.currency ? 'currency' : 'decimal',
        currency: options.currency,
        minimumFractionDigits: options.minimumFractionDigits ?? 2,
        maximumFractionDigits: options.maximumFractionDigits ?? 6,
    }).format(parsed);
}

/**
 * Calculate price change percentage
 */
export function calculateChange(current: bigint, previous: bigint): number {
    if (previous === 0n) return 0;
    return Number((current - previous) * 10000n / previous) / 100;
}

/**
 * Check if price is stale
 * @param timestamp - Price timestamp
 * @param maxAgeSeconds - Maximum age in seconds
 */
export function isPriceStale(timestamp: Date, maxAgeSeconds: number): boolean {
    const ageMs = Date.now() - timestamp.getTime();
    return ageMs > maxAgeSeconds * 1000;
}

/**
 * Get feed by category
 */
export function getFeedsByCategory(category: keyof typeof FEED_CATEGORIES): string[] {
    return FEED_CATEGORIES[category]?.feeds || [];
}

/**
 * Validate feed ID format
 */
export function isValidFeedId(feedId: string): boolean {
    // Valid formats: "BASE/QUOTE" or "ASSET/PERIOD"
    return /^[A-Z0-9_]+\/[A-Z0-9_]+$/.test(feedId);
}

/**
 * Build a feed ID from base and quote
 */
export function buildFeedId(base: string, quote: string): string {
    return `${base.toUpperCase()}/${quote.toUpperCase()}`;
}

/**
 * Parse a feed ID into components
 */
export function parseFeedId(feedId: string): { base: string; quote: string } {
    const [base, quote] = feedId.split('/');
    return { base, quote };
}
