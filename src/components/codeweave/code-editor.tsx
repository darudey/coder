
'use client';

import { Textarea } from '@/components/ui/textarea';
import type { FC } from 'react';
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CoderKeyboard } from './coder-keyboard';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
}

const parseCode = (code: string) => {
  const tokens = [];
  const keywordRegex = /\b(function|return|const|let|var|if|else|for|while|switch|case|break|continue|new|this|true|false|null|undefined|typeof|instanceof|console|log)\b/g;
  const stringRegex = /(".*?"|'.*?'|`.*?`)/g;
  const numberRegex = /\b\d+(\.\d+)?\b/g;
  const commentRegex = /(\/\/.*|\/\*[\s\S]*?\*\/)/g;
  const operatorRegex = /([+\-*/%<>=!&|?:;,.(){}[\]])/g;

  const allRegex = new RegExp(`(${keywordRegex.source}|${stringRegex.source}|${numberRegex.source}|${commentRegex.source}|${operatorRegex.source})`, 'g');

  let lastIndex = 0;
  let match;

  while ((match = allRegex.exec(code)) !== null) {
    const textBefore = code.slice(lastIndex, match.index);
    if (textBefore) {
      tokens.push({ type: 'default', value: textBefore });
    }

    const matchedValue = match[0];
    let type = 'default';
    if (keywordRegex.test(matchedValue)) type = 'keyword';
    else if (stringRegex.test(matchedValue)) type = 'string';
    else if (commentRegex.test(matchedValue)) type = 'comment';
    else if (numberRegex.test(matchedValue)) type = 'number';
    else if (operatorRegex.test(matchedValue)) type = 'operator';
    
    // Have to reset regex state after manual test
    keywordRegex.lastIndex = 0;
    stringRegex.lastIndex = 0;
    commentRegex.lastIndex = 0;
    numberRegex.lastIndex = 0;
    operatorRegex.lastIndex = 0;
    
    tokens.push({ type, value: matchedValue });
    lastIndex = match.index + matchedValue.length;
  }

  const textAfter = code.slice(lastIndex);
  if (textAfter) {
    tokens.push({ type: 'default', value: textAfter });
  }
  
  return tokens;
};


const getTokenClassName = (type: string) => {
  switch (type) {
    case 'keyword':
      return 'text-blue-600';
    case 'string':
      return 'text-green-600';
    case 'comment':
      return 'text-gray-500 italic';
    case 'number':
      return 'text-purple-600';
    case 'operator':
      return 'text-red-500';
    default:
      return 'text-black';
  }
}

export const CodeEditor: FC<CodeEditorProps> = ({ code, onCodeChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isMobile = useIsMobile();
  const metaKeyPressed = useRef(false);
  const [ctrlActive, setCtrlActive] = useState(false);

  const lineCount = useMemo(() => code.split('\n').length, [code]);

  const handleScroll = () => {
    if (textareaRef.current && preRef.current && lineNumbersRef.current) {
        const scrollTop = textareaRef.current.scrollTop;
        const scrollLeft = textareaRef.current.scrollLeft;
        preRef.current.scrollTop = scrollTop;
        preRef.current.scrollLeft = scrollLeft;
        lineNumbersRef.current.scrollTop = scrollTop;
    }
  };

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
        return;
      default:
        const pairMap: {[key:string]: string} = {
            '(': ')',
            '{': '}',
            '[': ']',
            "'": "'",
            '"': '"',
            '`': '`',
        };

        if (pairMap[key] && key.length === 1 && !/^\d$/.test(key)) {
            const open = key;
            const close = pairMap[key];
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
        (!keyboard || !keyboard.contains(target)) &&
        preRef.current && !preRef.current.contains(target) &&
        lineNumbersRef.current && !lineNumbersRef.current.contains(target)
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
        return;
    }
    metaKeyPressed.current = false;

    if (e.key === 'Tab') {
        e.preventDefault();
        handleKeyPress('Tab');
    }
  };

  const showKeyboard = isMobile || isKeyboardVisible;
  const editorStyles: React.CSSProperties = {
      fontFamily: 'var(--font-code)',
      fontSize: '1rem',
      lineHeight: '1.5',
      padding: '1rem',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
  };

  const highlightedCode = useMemo(() => {
    const tokens = parseCode(code);
    return (
        <>
            {tokens.map((token, i) => (
                <span key={i} className={getTokenClassName(token.type)}>
                    {token.value}
                </span>
            ))}
            {/* Add a newline to ensure last line is rendered */}
            {'\n'}
        </>
    );
  }, [code]);

  return (
    <>
      <Card className="flex flex-col h-full overflow-hidden shadow-lg">
        <CardContent className="flex flex-col flex-grow p-0">
          <div className="flex flex-grow h-full">
            <div
                ref={lineNumbersRef}
                className="bg-gray-100 text-right select-none overflow-y-hidden"
                style={{ ...editorStyles, paddingRight: '1rem', whiteSpace: 'pre' }}
                aria-hidden="true"
            >
                {Array.from({ length: lineCount }, (_, i) => (
                    <div
                        key={i}
                        className={cn("text-gray-400", i % 2 === 1 ? 'bg-gray-200' : 'bg-gray-100')}
                    >
                        {i + 1}
                    </div>
                ))}
            </div>
            <div className="relative flex-grow h-full">
                <pre
                    ref={preRef}
                    aria-hidden="true"
                    className="absolute inset-0 m-0 font-code text-base overflow-auto pointer-events-none"
                    style={editorStyles}
                >
                    {highlightedCode}
                </pre>
                <Textarea
                    ref={textareaRef}
                    value={code}
                    inputMode={isMobile ? 'none' : 'text'}
                    onChange={(e) => onCodeChange(e.target.value)}
                    onScroll={handleScroll}
                    onKeyDown={handleNativeKeyDown}
                    onClick={() => setIsKeyboardVisible(true)}
                    placeholder="Enter your JavaScript code here..."
                    className={cn(
                    "font-code text-base flex-grow w-full h-full resize-none rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent caret-black"
                    )}
                    style={editorStyles}
                    spellCheck="false"
                />
            </div>
          </div>
        </CardContent>
      </Card>
      <div id="coder-keyboard" className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out",
        showKeyboard ? "translate-y-0" : "translate-y-full"
      )}>
        <CoderKeyboard onKeyPress={handleKeyPress} ctrlActive={ctrlActive} onHide={() => setIsKeyboardVisible(false)} />
      </div>
    </>
  );
};
