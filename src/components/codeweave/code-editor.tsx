
'use client';

import { Textarea } from '@/components/ui/textarea';
import type { FC } from 'react';
import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoderKeyboard } from './coder-keyboard';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

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
      const keyboard = document.getElementById('coder-keyboard');
      const target = event.target as Node;
      if (
        textareaRef.current &&
        !textareaRef.current.contains(target) &&
        (!keyboard || !keyboard.contains(target))
      ) {
        setIsKeyboardVisible(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  const showKeyboard = isMobile || isKeyboardVisible;

  return (
    <>
      <Card className="flex flex-col h-full overflow-hidden shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">JavaScript Input</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col flex-grow p-0">
          <Textarea
            ref={textareaRef}
            value={code}
            inputMode={isMobile ? 'none' : 'text'}
            onChange={(e) => onCodeChange(e.target.value)}
            onFocus={() => setIsKeyboardVisible(true)}
            placeholder="Enter your JavaScript code here..."
            className="font-code text-base flex-grow w-full h-full resize-none rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 caret-black"
          />
        </CardContent>
      </Card>
      <div id="coder-keyboard" className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out",
        showKeyboard ? "translate-y-0" : "translate-y-full"
      )}>
        <CoderKeyboard onKeyPress={handleKeyPress} />
      </div>
    </>
  );
};
