
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getHighlightedCode } from '@/app/actions';
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
  coderKeyboard: boolean;
}

export function Compiler() {
  const [code, setCode] = useState<string>(defaultCode);
  const [highlightedCode, setHighlightedCode] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    syntaxHighlighting: true,
    errorChecking: true,
    coderKeyboard: true,
  });

  const debouncedCode = useDebounce(code, 500);

  const handleRun = async () => {
    setIsCompiling(true);
    const codeToRun = encodeURIComponent(code);
    const errorChecking = settings.errorChecking;
    const url = `/output?code=${codeToRun}&errorChecking=${errorChecking}`;
    window.open(url, '_blank');
    setIsCompiling(false);
  };

  const handleHighlight = useCallback(async () => {
    if (settings.syntaxHighlighting && debouncedCode) {
      const ansiCode = await getHighlightedCode(debouncedCode);
      const htmlCode = AnsiToHtml(ansiCode);
      setHighlightedCode(htmlCode);
    } else {
      setHighlightedCode(debouncedCode.replace(/\n/g, '<br>'));
    }
  }, [debouncedCode, settings.syntaxHighlighting]);

  useEffect(() => {
    handleHighlight();
  }, [handleHighlight]);

  return (
    <div className="flex flex-col h-screen">
      <Header onRun={handleRun} onSettings={() => setIsSettingsOpen(true)} isCompiling={isCompiling} />
      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-hidden">
        <CodeEditor
          code={code}
          onCodeChange={setCode}
          showKeyboard={settings.coderKeyboard}
        />
        <OutputDisplay
          output={null}
          highlightedCode={highlightedCode}
          isCompiling={isCompiling}
          showSyntaxHighlighting={settings.syntaxHighlighting}
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
