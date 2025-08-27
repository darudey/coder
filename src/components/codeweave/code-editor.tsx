
'use client';

import { Textarea } from '@/components/ui/textarea';
import type { FC } from 'react';
import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoderKeyboard } from './coder-keyboard';
import { useIsMobile } from '@/hooks/use-mobile';

interface CodeEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
}

export const CodeEditor: FC<CodeEditorProps> = ({ code, onCodeChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isMobile = useIsMobile();

  const handleKeyPress = (key: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    let newCode = code;
    let newCursorPosition = start;

    switch (key) {
      case 'Backspace':
        if (start === end && start > 0) {
          newCode = code.substring(0, start - 1) + code.substring(end);
          newCursorPosition = start - 1;
        } else {
          newCode = code.substring(0, start) + code.substring(end);
          newCursorPosition = start;
        }
        break;
      case 'Enter':
        newCode = code.substring(0, start) + '\n' + code.substring(end);
        newCursorPosition = start + 1;
        break;
      case 'Tab':
        newCode = code.substring(0, start) + '  ' + code.substring(end);
        newCursorPosition = start + 2;
        break;
      default:
        let insertion = key;
        let cursorOffset = key.length;

        if (key.endsWith('( )') || key.endsWith('{ }') || key.endsWith('[ ]') || key.endsWith("' '") || key.endsWith('" "') || key.endsWith('` `')) {
            insertion = key.slice(0, key.length / 2);
            cursorOffset = key.length / 2;
        }
        
        newCode = code.substring(0, start) + insertion + code.substring(end);
        newCursorPosition = start + cursorOffset;
    }

    onCodeChange(newCode);

    requestAnimationFrame(() => {
      textarea.selectionStart = newCursorPosition;
      textarea.selectionEnd = newCursorPosition;
      textarea.focus();
    });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setIsKeyboardVisible(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [textareaRef]);
  
  const showKeyboard = isMobile || isKeyboardVisible;

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
          onFocus={() => setIsKeyboardVisible(true)}
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
