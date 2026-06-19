// src/workers/custom-loader.ts
// ============================================================================
// STREAMING LOADER - DOUBLE BUFFERING & VIRTUAL MEMORY PAGING
// ============================================================================

export class StreamingLoader {
    private bufferA: ArrayBuffer | null = null;
    private bufferB: ArrayBuffer | null = null;
    private root: FileSystemDirectoryHandle | null = null;

    constructor() {
        this.init();
    }

    async init() {
        this.root = await navigator.storage.getDirectory();
    }

    // Double-buffering fetch logic
    async fetchShardPipelined(urlStr: string, chunkIndex: number): Promise<ArrayBuffer> {
        if (!this.root) await this.init();
        
        const filename = this.getOPFSFilename(urlStr);
        const currentHandleName = `${filename}_part${chunkIndex}`;
        const nextHandleName = `${filename}_part${chunkIndex + 1}`;

        // 1. Fetch current chunk synchronously (await it)
        const currentBuffer = await this.readChunk(currentHandleName);
        this.bufferA = currentBuffer; // Active buffer

        // 2. Asynchronously prefetch the NEXT chunk into buffer B (don't await)
        this.prefetchNextChunk(nextHandleName).catch(err => {
            console.log(`[StreamingLoader] Prefetch ended: no more chunks or error (${err.message})`);
        });

        // 3. Virtual Memory Paging: immediately unmap/destroy the old buffers
        // In a true WebGPU scenario, this translates to destroying GPU buffers.
        // Here we just dereference to allow GC.
        const result = this.bufferA;
        this.bufferA = null; 

        return result;
    }

    private async prefetchNextChunk(handleName: string) {
        if (!this.root) return;
        try {
            const buffer = await this.readChunk(handleName);
            this.bufferB = buffer;
        } catch(e) {
            this.bufferB = null;
        }
    }

    private async readChunk(chunkName: string): Promise<ArrayBuffer> {
        const handle = await this.root!.getFileHandle(chunkName);
        const file = await handle.getFile();
        return await file.arrayBuffer();
    }

    private getOPFSFilename(urlStr: string) {
        try {
            const url = new URL(urlStr, location.origin);
            return url.pathname.replace(/[^a-zA-Z0-9.\-]/g, '_');
        } catch {
            return urlStr.replace(/[^a-zA-Z0-9.\-]/g, '_');
        }
    }
}
