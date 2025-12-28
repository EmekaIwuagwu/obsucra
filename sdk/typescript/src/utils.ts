/**
 * Utility functions for Obscura SDK
 */

import { CHAIN_IDS, SupportedChain } from './types';

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        baseDelayMs?: number;
        maxDelayMs?: number;
    } = {}
): Promise<T> {
    const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 10000 } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt === maxRetries) {
                break;
            }

            const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert chain name to chain ID
 */
export function chainToId(chain: SupportedChain): number {
    return CHAIN_IDS[chain];
}

/**
 * Convert chain ID to chain name
 */
export function idToChain(chainId: number): SupportedChain | undefined {
    const entry = Object.entries(CHAIN_IDS).find(([_, id]) => id === chainId);
    return entry ? entry[0] as SupportedChain : undefined;
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
    if (!isValidAddress(address)) return address;
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return bytes;
}

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delayMs: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => fn(...args), delayMs);
    };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    limitMs: number
): (...args: Parameters<T>) => void {
    let lastRun = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
        const now = Date.now();

        if (now - lastRun >= limitMs) {
            lastRun = now;
            fn(...args);
        } else if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastRun = Date.now();
                timeoutId = null;
                fn(...args);
            }, limitMs - (now - lastRun));
        }
    };
}

/**
 * Create a simple event emitter
 */
export function createEventEmitter<Events extends Record<string, any>>() {
    const listeners = new Map<keyof Events, Set<Function>>();

    return {
        on<K extends keyof Events>(event: K, callback: (data: Events[K]) => void) {
            if (!listeners.has(event)) {
                listeners.set(event, new Set());
            }
            listeners.get(event)!.add(callback);

            return () => {
                listeners.get(event)?.delete(callback);
            };
        },

        emit<K extends keyof Events>(event: K, data: Events[K]) {
            listeners.get(event)?.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Event handler error for ${String(event)}:`, error);
                }
            });
        },

        off<K extends keyof Events>(event: K, callback: Function) {
            listeners.get(event)?.delete(callback);
        },

        clear() {
            listeners.clear();
        },
    };
}

/**
 * Format a big number with thousands separators
 */
export function formatBigNumber(value: bigint | string, decimals: number = 0): string {
    const bigValue = typeof value === 'string' ? BigInt(value) : value;
    const str = bigValue.toString();

    if (decimals === 0) {
        return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    const intPart = str.slice(0, -decimals) || '0';
    const decPart = str.slice(-decimals).padStart(decimals, '0');

    return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decPart}`;
}

/**
 * Calculate percentage
 */
export function percent(value: number, total: number): number {
    if (total === 0) return 0;
    return (value / total) * 100;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if running in Node.js environment
 */
export function isNode(): boolean {
    return typeof process !== 'undefined' &&
        process.versions !== undefined &&
        process.versions.node !== undefined;
}
