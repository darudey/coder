
'use client';

import React, { useState } from 'react';
import { runCode, type RunResult } from '@/app/actions';
import { CodeEditor } from './code-editor';
import { Header } from './header';
import { SettingsPanel } from './settings-panel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OutputDisplay } from './output-display';


const defaultCode = `// Welcome to CodeWeave!
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
`;

export interface Settings {
  syntaxHighlighting: boolean;
  errorChecking: boolean;
}

export function Compiler() {
  const [code, setCode] = useState<string>(defaultCode);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    syntaxHighlighting: true,
    errorChecking: false,
  });
  const [output, setOutput] = useState<RunResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);

  const handleRun = async () => {
    setIsCompiling(true);
    const result = await runCode(code, settings.errorChecking);
    setOutput(result);
    setIsResultOpen(true);
    setIsCompiling(false);
  };

  return (
    <div className="flex flex-col h-screen">
      <Header onRun={handleRun} onSettings={() => setIsSettingsOpen(true)} isCompiling={isCompiling} />
      <div className="flex-grow p-4 grid grid-cols-1 gap-4 overflow-hidden">
        <CodeEditor
          code={code}
          onCodeChange={setCode}
          withSyntaxHighlighting={settings.syntaxHighlighting}
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
