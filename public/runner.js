// A more robust runner that captures logs, errors, and handles timeouts

// Override console.log to capture output
const originalLog = console.log;
const outputBuffer = [];
console.log = (...args) => {
    // Instead of stringifying, we keep the structure
    outputBuffer.push(args);
};

self.onmessage = (e) => {
    const { code } = e.data;
    outputBuffer.length = 0; // Clear buffer for new run

    try {
        const result = eval(code);

        // If the last statement was an expression, its result is returned.
        // We add it to the output buffer as if it were logged.
        if (result !== undefined) {
             outputBuffer.push([result]);
        }
        
        self.postMessage({
            output: outputBuffer, // Send the structured buffer
            type: 'result'
        });

    } catch (err) {
        let errorMessage = 'An unknown error occurred.';
        if (err instanceof Error) {
            errorMessage = `${err.name}: ${err.message}`;
            if (err.stack) {
                // Try to extract a meaningful line number from the stack
                const stackMatch = err.stack.match(/<anonymous>:(\d+):(\d+)/);
                if (stackMatch) {
                    errorMessage += ` (at line ${parseInt(stackMatch[1], 10) - 2})`;
                }
            }
        } else {
            errorMessage = String(err);
        }

        self.postMessage({
            output: [[errorMessage]], // Keep structure consistent
            type: 'error'
        });
    }
};
