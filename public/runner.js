self.onmessage = (e) => {
  const { code } = e.data;
  const capturedLogs = [];
  const originalConsoleLog = self.console.log;

  self.console.log = (...args) => {
    capturedLogs.push(
      args
        .map((arg) => {
          try {
            if (arg instanceof Error) {
              return arg.stack;
            }
            if (typeof arg === 'object' && arg !== null) {
              return JSON.stringify(arg, null, 2);
            }
            return String(arg);
          } catch (error) {
            return '[Unserializable Object]';
          }
        })
        .join(' ')
    );
  };

  try {
    let result = new Function(code)();
    self.console.log = originalConsoleLog;

    let output = capturedLogs.join('\n');

    if (result !== undefined) {
      const resultString = JSON.stringify(result, null, 2);
      output = output ? `${output}\n${resultString}` : resultString;
    } else if (capturedLogs.length === 0) {
      output = 'undefined';
    }
    self.postMessage({ output, type: 'result' });
  } catch (err) {
    self.console.log = originalConsoleLog;
    let errorMessage = 'An unknown error occurred.';
    if (err instanceof Error) {
        errorMessage = `${err.name}: ${err.message}\n${err.stack}`;
    } else {
        errorMessage = String(err);
    }
    self.postMessage({ output: errorMessage, type: 'error' });
  }
};
