
'use client';

import React, { useState } from 'react';
import { runCode, type RunResult } from '@/app/actions';
import { CodeEditor } from './code-editor';
import { Header } from './header';
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
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    syntaxHighlighting: true,
    errorChecking: true,
  });

  const handleRun = async () => {
    setIsCompiling(true);
    await runCode(code, settings.errorChecking);
    setIsCompiling(false);
  };

  return (
    <div className="flex flex-col h-screen">
      <Header onRun={handleRun} onSettings={() => setIsSettingsOpen(true)} isCompiling={isCompiling} />
      <div className="flex-grow p-4 overflow-hidden">
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
    </div>
  );
}
