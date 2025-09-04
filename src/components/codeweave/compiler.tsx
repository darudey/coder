
'use client';

import React, { useState } from 'react';
import { checkCodeForErrors, type RunResult } from '@/app/actions';
import { CodeEditor } from './code-editor';
import { Header } from './header';
import { SettingsPanel } from './settings-panel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OutputDisplay } from './output-display';


const defaultCode = `// Welcome to 24HrCoding!
// Your code now runs directly in the browser for instant results.
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
`;

export interface Settings {
  errorChecking: boolean;
}

const runCodeOnClient = (code: string): RunResult => {
    try {
        const capturedLogs: any[] = [];
        const originalConsoleLog = console.log;

        // Override console.log to capture output
        const customLog = (...args: any[]) => {
            capturedLogs.push(args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch (e) {
                        return '[Circular Object]';
                    }
                }
                return String(arg);
            }).join(' '));
        };
        
        // Temporarily replace console.log
        console.log = customLog;

        // In a real-world application, this should be sandboxed.
        let result = (new Function(code))();

        // Restore original console.log
        console.log = originalConsoleLog;

        let output = capturedLogs.join('\n');

        if (result !== undefined) {
            const resultString = JSON.stringify(result, null, 2);
            if (output) {
                output += `\n${resultString}`;
            } else {
                output = resultString
            }
        } else if (capturedLogs.length === 0) {
            output = 'undefined';
        }

        return {
            output: output,
            type: 'result',
        };
    } catch (e: any) {
        return {
            output: `${e.name}: ${e.message}`,
            type: 'error',
        };
    }
}

export function Compiler() {
  const [code, setCode] = useState<string>(defaultCode);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    errorChecking: false,
  });
  const [output, setOutput] = useState<RunResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);

  const handleRun = async () => {
    setIsCompiling(true);
    setIsResultOpen(true);

    let result: RunResult | null = null;

    if (settings.errorChecking) {
        result = await checkCodeForErrors(code);
    }
    
    // If AI check passed or was disabled, run code on the client
    if (!result) {
        result = runCodeOnClient(code);
    }

    setOutput(result);
    setIsCompiling(false);
  };

  return (
    <div className="flex flex-col h-screen">
      <Header onRun={handleRun} onSettings={() => setIsSettingsOpen(true)} isCompiling={isCompiling} />
      <div className="flex-grow p-4 grid grid-cols-1 gap-4 overflow-hidden">
        <CodeEditor
          code={code}
          onCodeChange={setCode}
        />
      </div>
      <SettingsPanel
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        onSettingsChange={setSettings}
      />
      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="max-w-2xl h-3/4 flex flex-col">
          <DialogHeader>
            <DialogTitle>Result</DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-hidden">
            <OutputDisplay output={output} isCompiling={isCompiling} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
