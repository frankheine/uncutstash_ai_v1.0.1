// src/rag/bloom.cache.ts
import { BloomFilter } from 'bloom-filters';

// Bloom Filter Configuration:
// Capacity: 1,000,000 items
// False Positive Rate: 1% (0.01)
// This strictly bounds memory usage to ~1.20 MB while allowing near-instant O(1) cache lookups
export const bloomCache = new BloomFilter(1000000, 0.01);

/**
 * Rapidly check if a prompt might exist in the distributed cache before querying the expensive LanceDB OPFS.
 * @param promptHash A unique identifier (hash) of the prompt or context
 * @returns boolean - True if it MIGHT exist (99% confidence), False if it DEFINITELY does not exist (100% confidence)
 */
export function mightHavePrompt(promptHash: string): boolean {
    return bloomCache.has(promptHash);
}

/**
 * Add a newly generated prompt/response hash to the Bloom filter index.
 * @param promptHash A unique identifier (hash) of the prompt or context
 */
export function addPromptToCache(promptHash: string): void {
    bloomCache.add(promptHash);
}

/**
 * Export the serialized Bloom filter state to save to OPFS.
 */
export function exportBloomState() {
    return bloomCache.saveAsJSON();
}

/**
 * Hydrate the Bloom filter from a saved OPFS state to resume caching without rebuilding.
 */
export function importBloomState(jsonState: any) {
    return BloomFilter.fromJSON(jsonState);
}
