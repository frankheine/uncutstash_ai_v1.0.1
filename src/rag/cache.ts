export class BloomFilter {
    private bitArray: Uint8Array;
    private size: number;
    private hashFunctions: ((item: string) => number)[];

    constructor(size = 100000, numHashes = 5) {
        this.size = size;
        this.bitArray = new Uint8Array(Math.ceil(size / 8));
        this.hashFunctions = [];

        // Generate multiple hash functions with different seeds
        for (let i = 0; i < numHashes; i++) {
            this.hashFunctions.push((item: string) => this.hash(item, i));
        }
    }

    private hash(str: string, seed: number): number {
        let h = seed;
        for (let i = 0; i < str.length; i++) {
            h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
        }
        return Math.abs(h) % this.size;
    }

    add(item: string) {
        for (const fn of this.hashFunctions) {
            const index = fn(item);
            const byteIndex = Math.floor(index / 8);
            const bitIndex = index % 8;
            this.bitArray[byteIndex] |= (1 << bitIndex);
        }
    }

    test(item: string): boolean {
        for (const fn of this.hashFunctions) {
            const index = fn(item);
            const byteIndex = Math.floor(index / 8);
            const bitIndex = index % 8;
            if ((this.bitArray[byteIndex] & (1 << bitIndex)) === 0) {
                return false; // Definitely not in set
            }
        }
        return true; // Probably in set
    }
}

export class RAGCacheInterceptor {
    private bloom: BloomFilter;
    private prefixRegistry: Map<string, { timestamp: number; context: string }>;

    constructor() {
        this.bloom = new BloomFilter();
        this.prefixRegistry = new Map();
    }

    registerPrefix(prefixKey: string, context: string) {
        this.bloom.add(prefixKey);
        this.prefixRegistry.set(prefixKey, {
            timestamp: Date.now(),
            context
        });
    }

    lookup(query: string): string | null {
        // Fast path: Exact match using Bloom filter
        if (this.bloom.test(query) && this.prefixRegistry.has(query)) {
            return this.prefixRegistry.get(query)!.context;
        }

        // Slow path: Longest Prefix matching
        let longestMatch = "";
        let bestContext: string | null = null; for (const [prefix, data] of this.prefixRegistry.entries()) {
            if (query.startsWith(prefix) && prefix.length > longestMatch.length) {
                longestMatch = prefix;
                bestContext = data.context;
            }
        }

        return bestContext;
    }

    purge(key: string) {
        // Removes specific key on 404 cache expiration
        this.prefixRegistry.delete(key);
    }
}

export const ragCache = new RAGCacheInterceptor();
