
// A simple web worker to run user code safely.

self.onmessage = (e) => {
  const { code } = e.data;
  const logs = [];

  // Override console.log to capture output
  const oldLog = console.log;
  console.log = (...args) => {
    // Mimic the browser console by joining arguments with a space
    // and stringifying objects/arrays.
    const formatted = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            return JSON.stringify(arg);
        }
        return String(arg);
    }).join(' ');
    logs.push([formatted]); // Keep the nested array structure for consistency
  };

  try {
    const startTime = performance.now();
    eval(code);
    const endTime = performance.now();
    const duration = endTime - startTime;
    self.postMessage({ output: logs, type: 'result', durationMs: duration });
  } catch (error) {
    self.postMessage({
      output: [[error.message]],
      type: 'error',
    });
  } finally {
    // Restore original console.log
    console.log = oldLog;
  }
};
