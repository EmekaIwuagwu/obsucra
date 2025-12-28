/**
 * VRF (Verifiable Random Function) utilities
 */

import { VRFRequest, VRFResult } from './types';

/**
 * Generate a random seed for VRF requests
 * @returns Random hex string
 */
export function generateSeed(): string {
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(array);
    } else {
        // Node.js fallback
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a deterministic seed from user input
 * @param input - User input to hash
 * @returns Deterministic seed
 */
export async function deterministicSeed(input: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Simple fallback hash
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Create a VRF request for a lottery/gaming use case
 * @param lotteryId - Unique lottery identifier
 * @param round - Round number
 */
export function createLotteryRequest(lotteryId: string, round: number): VRFRequest {
    return {
        seed: `lottery:${lotteryId}:${round}:${Date.now()}`,
        numWords: 1,
        callbackGasLimit: 100000,
    };
}

/**
 * Create a VRF request for NFT minting
 * @param collectionId - NFT collection identifier
 * @param tokenId - Token ID to mint
 */
export function createNFTMintRequest(collectionId: string, tokenId: string): VRFRequest {
    return {
        seed: `nft:${collectionId}:${tokenId}:${Date.now()}`,
        numWords: 1,
        callbackGasLimit: 150000,
    };
}

/**
 * Create a VRF request for game loot boxes
 * @param gameId - Game identifier
 * @param playerId - Player identifier
 * @param lootBoxId - Loot box identifier
 */
export function createLootBoxRequest(
    gameId: string,
    playerId: string,
    lootBoxId: string
): VRFRequest {
    return {
        seed: `loot:${gameId}:${playerId}:${lootBoxId}:${Date.now()}`,
        numWords: 3, // Multiple random values for loot
        callbackGasLimit: 200000,
    };
}

/**
 * Parse VRF result into usable random numbers
 * @param result - VRF result from oracle
 * @param max - Maximum value (exclusive)
 * @returns Array of random numbers in range [0, max)
 */
export function parseRandomNumbers(result: VRFResult, max: number): number[] {
    return result.randomWords.map(word => {
        const bigValue = BigInt(word);
        return Number(bigValue % BigInt(max));
    });
}

/**
 * Get a random element from an array using VRF
 * @param result - VRF result
 * @param array - Array to select from
 * @returns Random element from array
 */
export function selectRandom<T>(result: VRFResult, array: T[]): T {
    const [index] = parseRandomNumbers(result, array.length);
    return array[index];
}

/**
 * Shuffle an array using VRF (Fisher-Yates with deterministic randomness)
 * @param result - VRF result (needs multiple random words)
 * @param array - Array to shuffle
 * @returns Shuffled array copy
 */
export function shuffleWithVRF<T>(result: VRFResult, array: T[]): T[] {
    const shuffled = [...array];
    const randomNumbers = parseRandomNumbers(result, shuffled.length * 10);

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomNumbers[i % randomNumbers.length] % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

/**
 * Verify VRF proof (client-side verification)
 * Note: Full verification should be done on-chain
 * @param result - VRF result to verify
 * @returns Whether the basic structure is valid
 */
export function verifyVRFStructure(result: VRFResult): boolean {
    // Basic structure validation
    if (!result.requestId || !result.proof) {
        return false;
    }

    if (!result.randomWords || result.randomWords.length === 0) {
        return false;
    }

    // Check that random words are valid hex strings
    for (const word of result.randomWords) {
        if (!/^0x[0-9a-fA-F]+$/.test(word) && !/^[0-9]+$/.test(word)) {
            return false;
        }
    }

    return true;
}

/**
 * VRF callback interface for smart contracts
 */
export interface VRFCallbackInterface {
    /**
     * Function signature for rawFulfillRandomWords
     */
    rawFulfillRandomWords: string;

    /**
     * Encode callback data
     */
    encodeCallback(requestId: string, randomWords: string[]): string;
}

/**
 * Get VRF callback interface ABI
 */
export function getVRFCallbackABI(): object[] {
    return [
        {
            name: 'rawFulfillRandomWords',
            type: 'function',
            inputs: [
                { name: 'requestId', type: 'uint256' },
                { name: 'randomWords', type: 'uint256[]' },
            ],
        },
    ];
}
