
'use client';

import { Textarea } from '@/components/ui/textarea';
import type { FC } from 'react';
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
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
      return 'text-black dark:text-gray-300';
  }
}

export const CodeEditor: FC<CodeEditorProps> = ({ code, onCodeChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isMobile = useIsMobile();
  const metaKeyPressed = useRef(false);
  const [ctrlActive, setCtrlActive] = useState(false);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && gutterRef.current) {
        gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const updateLineNumbers = useCallback(() => {
      const ta = textareaRef.current;
      const gutter = gutterRef.current;
      const mirror = mirrorRef.current;

      if (!ta || !gutter || !mirror) return;

      mirror.style.width = ta.clientWidth + 'px';
      
      const lines = ta.value.split(/\r\n|\r|\n/);
      gutter.textContent = '';
      mirror.textContent = '';

      for (let i = 0; i < lines.length; i++) {
        const seg = document.createElement('span');
        seg.className = 'block';
        seg.textContent = (lines[i] === '' ? ' ' : lines[i]);
        mirror.appendChild(seg);
      }

      const segs = mirror.children;
      for (let i = 0; i < segs.length; i++) {
        const h = (segs[i] as HTMLElement).offsetHeight;
        const div = document.createElement('div');
        div.className = 'flex items-start h-full';
        div.textContent = (i + 1).toString();
        div.style.height = h + 'px';
        gutter.appendChild(div);
      }
      
      gutter.style.width = (String(lines.length).length * 8 + 17) + 'px';
      syncScroll();
  }, [syncScroll]);


  useEffect(() => {
    updateLineNumbers();
    const handleResize = () => updateLineNumbers();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    }
  }, [code, updateLineNumbers]);

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
        return;
    }
    metaKeyPressed.current = false;

    if (e.key === 'Tab') {
        e.preventDefault();
        handleKeyPress('Tab');
    }
  };

  const showKeyboard = isKeyboardVisible;
  
  const editorStyles: React.CSSProperties = {
      fontFamily: 'var(--font-code)',
      fontSize: '0.875rem',
      lineHeight: '1.5',
      padding: '0.5rem 0.75rem',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      tabSize: 2,
  };
  
  const highlightedCode = useMemo(() => {
    const lines = code.split('\n');
    return (
      <>
        {lines.map((line, lineIndex) => (
            <div key={lineIndex} className={cn(
              "min-h-[21px]",
              lineIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'
            )}>
              {line === '' ? <>&nbsp;</> : parseCode(line).map((token, tokenIndex) => (
                  <span key={tokenIndex} className={getTokenClassName(token.type)}>
                    {token.value}
                  </span>
                ))}
            </div>
        ))}
      </>
    );
  }, [code]);

  return (
    <>
      <Card className="flex flex-col h-full overflow-hidden shadow-lg">
        <CardContent className="flex flex-col flex-grow p-0">
          <div className="flex flex-grow h-full">
            <div 
              ref={gutterRef} 
              className="box-border p-2 pr-1 text-right text-gray-500 bg-gray-100 border-r border-gray-200 select-none overflow-y-auto overflow-x-hidden dark:bg-gray-900 dark:border-gray-700"
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: editorStyles.fontSize,
                lineHeight: editorStyles.lineHeight,
              }}
            >
            </div>
            <div className="relative flex-grow h-full">
                <div
                    aria-hidden="true"
                    className="absolute inset-0 m-0 pointer-events-none"
                    style={editorStyles}
                >
                    {highlightedCode}
                </div>
                <Textarea
                    ref={textareaRef}
                    value={code}
                    inputMode={isMobile ? 'none' : 'text'}
                    onChange={(e) => onCodeChange(e.target.value)}
                    onScroll={syncScroll}
                    onKeyDown={handleNativeKeyDown}
                    onClick={() => setIsKeyboardVisible(true)}
                    placeholder="Enter your JavaScript code here..."
                    className={cn(
                    "font-code text-base flex-grow w-full h-full resize-none rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 caret-black dark:caret-white",
                    "bg-transparent relative z-10"
                    )}
                    style={{...editorStyles, color: 'transparent'}}
                    spellCheck="false"
                />
                <div 
                    ref={mirrorRef}
                    aria-hidden="true"
                    className="absolute top-0 left-0 invisible pointer-events-none"
                    style={{
                      fontFamily: 'var(--font-code)',
                      fontSize: editorStyles.fontSize,
                      lineHeight: editorStyles.lineHeight,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      padding: '0.5rem 0.75rem',
                      boxSizing: 'border-box'
                    }}
                ></div>
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

    

    

