
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
  const metaKeyPressed = useRef(false);
  const [ctrlActive, setCtrlActive] = useState(false);


  const handleKeyPress = (key: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (key === 'Ctrl') {
        setCtrlActive(prev => !prev);
        return;
    }

    if (ctrlActive && key.toLowerCase() === 'a') {
        textarea.select();
        setCtrlActive(false); 
        return;
    }


    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    let newCode = code;
    let newCursorPosition = start;

    switch (key) {
      case 'ArrowLeft':
        if (start > 0) {
          newCursorPosition = start - 1;
        }
        break;
      case 'ArrowRight':
        if (start < code.length) {
            newCursorPosition = start + 1;
        }
        break;
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
      case 'CapsLock':
      case 'Shift':
        // Do nothing for modifier keys from virtual keyboard,
        // native shortcuts will be handled by the browser.
        return;
      default:
        const pairMap: {[key:string]: string} = {
            '(': ')',
            '{': '}',
            '[': ']',
            "'": "'",
            '"': '"',
            '`': '`',
            '( )': '()',
            '{ }': '{}',
            '[ ]': '[]',
            "' '": "''",
            '" "': '""',
            '` `': '``'
        };

        if (pairMap[key]) {
            const pair = pairMap[key];
            const open = pair[0];
            const close = pair.length > 1 ? pair[1] : '';
            newCode = code.substring(0, start) + open + close + code.substring(end);
            newCursorPosition = start + 1;
        } else {
            newCode = code.substring(0, start) + key + code.substring(end);
            newCursorPosition = start + key.length;
        }
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
  
  const handleNativeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.metaKey || e.ctrlKey) {
        metaKeyPressed.current = true;
        // Allow native behavior for shortcuts like Ctrl+A, Ctrl+C, etc.
        return;
    }
    metaKeyPressed.current = false;

    if (e.key === 'Tab') {
        e.preventDefault();
        handleKeyPress('Tab');
    }
  };

  const showKeyboard = isMobile || isKeyboardVisible;

  return (
    <>
      <Card className="flex flex-col h-full overflow-hidden shadow-lg">
        <CardContent className="flex flex-col flex-grow p-4">
          <Textarea
            ref={textareaRef}
            value={code}
            inputMode={isMobile ? 'none' : 'text'}
            onChange={(e) => {
                if (!metaKeyPressed.current) {
                    onCodeChange(e.target.value)
                }
            }}
            onKeyDown={handleNativeKeyDown}
            onFocus={() => setIsKeyboardVisible(true)}
            placeholder="Enter your JavaScript code here..."
            className="font-code text-base flex-grow w-full h-full resize-none rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 caret-black bg-white"
          />
        </CardContent>
      </Card>
      <div id="coder-keyboard" className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out",
        showKeyboard ? "translate-y-0" : "translate-y-full"
      )}>
        <CoderKeyboard onKeyPress={handleKeyPress} ctrlActive={ctrlActive} />
      </div>
    </>
  );
};
