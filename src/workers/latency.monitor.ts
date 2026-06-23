/// <reference lib="webworker" />

self.onmessage = (e) => {
    const { sab, command } = e.data;

    if (command === 'init-sab') {
        const i32 = new Int32Array(sab);
        
        // Background Infinite Loop for SAB Ping-Pong
        // This completely blocks this dedicated worker, which is fine!
        const runPingPong = () => {
            while (true) {
                // Wait for Main Thread to flip index 0 from 0 to 1
                // Atomics.wait blocks the thread at the silicon level without eating CPU cycles
                const waitStatus = Atomics.wait(i32, 0, 0); 
                
                if (waitStatus === 'ok') {
                    // Instantly capture the timestamp of the wake-up
                    const wakeTime = performance.now();
                    
                    // The main thread wrote its exact transmission timestamp into index 1
                    // However, we are limited to Int32, so we can't store a floating point timestamp directly.
                    // Instead, we just write the result back via postMessage for simplicity in this diagnostic.
                    self.postMessage({ type: 'sab-ping', wakeTime });

                    // Reset state
                    Atomics.store(i32, 0, 0);
                } else if (waitStatus === 'timed-out') {
                    // Do nothing, just loop
                }
            }
        };

        // Fire off the blocking loop asynchronously so we don't block subsequent init messages if any
        setTimeout(runPingPong, 0);
    }

    if (command === 'postmessage-ping') {
        const { sentTime } = e.data;
        const wakeTime = performance.now();
        self.postMessage({ type: 'postmessage-ping', sentTime, wakeTime });
    }
};

export {};
