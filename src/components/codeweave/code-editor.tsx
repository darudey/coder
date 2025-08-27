
'use client';

import { Textarea } from '@/components/ui/textarea';
import type { FC } from 'react';
import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoderKeyboard } from './coder-keyboard';

interface CodeEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
  showKeyboard: boolean;
}

export const CodeEditor: FC<CodeEditorProps> = ({ code, onCodeChange, showKeyboard }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyPress = (key: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const newValue = code.substring(0, start) + key + code.substring(end);
    onCodeChange(newValue);

    const newCursorPosition = start + key.length;

    requestAnimationFrame(() => {
      textarea.selectionStart = newCursorPosition;
      textarea.selectionEnd = newCursorPosition;
      textarea.focus();
    });
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline">JavaScript Input</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow p-0">
        <Textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder="Enter your JavaScript code here..."
          className="font-code text-base flex-grow w-full h-full resize-none rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {showKeyboard && (
          <>
            <div className="border-t"></div>
            <CoderKeyboard onKeyPress={handleKeyPress} />
          </>
        )}
      </CardContent>
    </Card>
  );
};
