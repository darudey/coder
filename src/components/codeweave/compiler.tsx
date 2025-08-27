
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { runCode, getHighlightedCode, type RunResult } from '@/app/actions';
import { useDebounce } from '@/hooks/use-debounce';
import AnsiToHtml from '@/lib/ansi-to-html';
import { CodeEditor } from './code-editor';
import { Header } from './header';
import { OutputDisplay } from './output-display';
import { SettingsPanel } from './settings-panel';

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
  const [output, setOutput] = useState<RunResult | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    syntaxHighlighting: true,
    errorChecking: true,
  });


  const handleRun = async () => {
    setIsCompiling(true);
    const result = await runCode(code, settings.errorChecking);
    setOutput(result);
    setIsCompiling(false);
  };


  return (
    <div className="flex flex-col h-screen">
      <Header onRun={handleRun} onSettings={() => setIsSettingsOpen(true)} isCompiling={isCompiling} />
      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-hidden">
        <CodeEditor
          code={code}
          onCodeChange={setCode}
        />
        <OutputDisplay
          output={output}
          isCompiling={isCompiling}
        />
      </div>
      <SettingsPanel
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  );
}
