/// <reference lib="webworker" />

export type StorageMessage = 
    | { type: 'WRITE_SYNC'; filename: string; data: Uint8Array; offset?: number }
    | { type: 'READ_SYNC'; filename: string; offset?: number; length?: number }
    | { type: 'DELETE_FILE'; filename: string };

self.onmessage = async (e: MessageEvent<StorageMessage>) => {
    const root = await navigator.storage.getDirectory();
    
    switch (e.data.type) {
        case 'WRITE_SYNC': {
            const { filename, data, offset = 0 } = e.data;
            // Wrap all OPFS write operations inside the Web Locks API
            await navigator.locks.request(`opfs-write-lock-${filename}`, async () => {
                const fileHandle = await root.getFileHandle(filename, { create: true });
                // @ts-ignore - TypeScript sometimes misses the synchronous OPFS APIs in standard libs
                const accessHandle = await fileHandle.createSyncAccessHandle();
                try {
                    accessHandle.write(data, { at: offset });
                    accessHandle.flush();
                } finally {
                    accessHandle.close();
                }
            });
            self.postMessage({ status: 'success', action: 'WRITE_SYNC', filename });
            break;
        }

        case 'READ_SYNC': {
            const { filename, offset = 0, length } = e.data;
            // Reading doesn't strictly need a lock, but we can lock in 'shared' mode if we want.
            // For now, we just lock exclusively to prevent reading while a write is occurring.
            await navigator.locks.request(`opfs-write-lock-${filename}`, { mode: 'shared' }, async () => {
                const fileHandle = await root.getFileHandle(filename);
                // @ts-ignore
                const accessHandle = await fileHandle.createSyncAccessHandle();
                try {
                    const size = length || accessHandle.getSize() - offset;
                    const buffer = new Uint8Array(size);
                    accessHandle.read(buffer, { at: offset });
                    self.postMessage({ status: 'success', action: 'READ_SYNC', filename, data: buffer }, [buffer.buffer]);
                } finally {
                    accessHandle.close();
                }
            });
            break;
        }

        case 'DELETE_FILE': {
            const { filename } = e.data;
            await navigator.locks.request(`opfs-write-lock-${filename}`, async () => {
                await root.removeEntry(filename);
            });
            self.postMessage({ status: 'success', action: 'DELETE_FILE', filename });
            break;
        }
    }
};
