
'use client';

import { Textarea } from '@/components/ui/textarea';
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CoderKeyboard } from './coder-keyboard';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogAction, AlertDialogCancel } from '../ui/alert-dialog';
import { getSuggestions, type Suggestion } from '@/lib/autocomplete';
import { AutocompleteDropdown } from './autocomplete-dropdown';
import { getCaretCoordinates } from '@/lib/caret-position';
import { useDebounce } from '@/hooks/use-debounce';
import { useSettings } from '@/hooks/use-settings';

interface CodeEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteFile: () => void;
  hasActiveFile: boolean;
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

const MemoizedCodeEditor: React.FC<CodeEditorProps> = ({ code, onCodeChange, onUndo, onRedo, onDeleteFile, hasActiveFile }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isMobile = useIsMobile();
  const [ctrlActive, setCtrlActive] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { settings } = useSettings();
  const fontSize = settings.editorFontSize;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const debouncedCode = useDebounce(code, 150);

  const updateSuggestions = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { suggestions, word } = getSuggestions(code, textarea.selectionStart);
    if(suggestions.length > 0) {
        setSuggestions(suggestions);
        setActiveSuggestion(0);
        const coords = getCaretCoordinates(textarea, textarea.selectionStart);
        setSuggestionPos({
            top: coords.top + coords.height,
            left: coords.left - (word.length * (fontSize * 0.6)), // Approximate char width
        });
    } else {
        setSuggestions([]);
    }
  }, [code, fontSize]);

  useEffect(() => {
    updateSuggestions();
  }, [debouncedCode, updateSuggestions]);


  const syncScroll = useCallback(() => {
    if (textareaRef.current && gutterRef.current && editorContainerRef.current) {
        const scrollTop = textareaRef.current.scrollTop;
        gutterRef.current.scrollTop = scrollTop;
    }
  }, []);

  const updateLineNumbers = useCallback(() => {
      const ta = textareaRef.current;
      const gutter = gutterRef.current;
      const mirror = mirrorRef.current;

      if (!ta || !gutter || !mirror) return;

      const scrollTop = ta.scrollTop;

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
      
      ta.scrollTop = scrollTop;
      gutter.scrollTop = scrollTop;
  }, []);


  useEffect(() => {
    updateLineNumbers();
    const handleResize = () => updateLineNumbers();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    }
  }, [code, updateLineNumbers, fontSize]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !isMobile) return;

    const handleFocus = () => {
        setTimeout(() => {
            const caretPos = getCaretCoordinates(textarea, textarea.selectionStart);
            const visibleBottom = textarea.scrollTop + textarea.clientHeight;
            const caretBottom = caretPos.top + caretPos.height;

            if (caretBottom > visibleBottom * 0.9) { // If caret is in the bottom 90%
                const scrollAmount = caretBottom - (textarea.clientHeight * 0.5); // scroll to middle
                textarea.scrollTo({ top: scrollAmount, behavior: 'smooth' });
            }
        }, 100);
    };
    
    textarea.addEventListener('focus', handleFocus);
    textarea.addEventListener('keyup', handleFocus);
    
    return () => {
      textarea.removeEventListener('focus', handleFocus);
      textarea.removeEventListener('keyup', handleFocus);
    };

  }, [isMobile, code]);

  const handleSuggestionSelection = useCallback((suggestion: Suggestion) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { word, startPos } = getSuggestions(code, textarea.selectionStart);
    
    const newCode = code.substring(0, startPos) + suggestion.value + code.substring(textarea.selectionStart);
    const newCursorPosition = startPos + suggestion.value.length;
    
    onCodeChange(newCode);
    setSuggestions([]);

    requestAnimationFrame(() => {
        textarea.selectionStart = newCursorPosition;
        textarea.selectionEnd = newCursorPosition;
        textarea.focus();
    });
  }, [code, onCodeChange]);

  const handleNavigateSuggestions = useCallback((direction: 'next' | 'prev') => {
      if (suggestions.length === 0) return;
      if (direction === 'next') {
          setActiveSuggestion(prev => (prev + 1) % suggestions.length);
      } else {
          setActiveSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length);
      }
  }, [suggestions.length]);

  const handleKeyPress = useCallback(async (key: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (key === 'Ctrl') {
        setCtrlActive(prev => !prev);
        return;
    }

    if (ctrlActive) {
      setCtrlActive(false); // Consume the Ctrl press
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      switch (key.toLowerCase()) {
        case 'a':
            textarea.select();
            break;
        case 'z':
            onUndo();
            break;
        case 'y':
            onRedo();
            break;
        case 'd':
            if(hasActiveFile) {
                setShowDeleteConfirm(true);
            }
            break;
        case 'c': { // Copy
            let textToCopy = code.substring(start, end);
            if (start === end) {
                const lineStart = code.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = code.indexOf('\n', start);
                textToCopy = code.substring(lineStart, lineEnd === -1 ? code.length : lineEnd);
            }
            await navigator.clipboard.writeText(textToCopy);
            break;
        }
        case 'x': { // Cut
            let textToCut = code.substring(start, end);
            let selectionStart = start;
            let selectionEnd = end;

            if (start === end) {
                selectionStart = code.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = code.indexOf('\n', start);
                selectionEnd = lineEnd === -1 ? code.length : lineEnd + (lineEnd === code.length -1 ? 0 : 1);
                textToCut = code.substring(selectionStart, selectionEnd);
            }
            
            await navigator.clipboard.writeText(textToCut);
            
            const newCode = code.substring(0, selectionStart) + code.substring(selectionEnd);
            onCodeChange(newCode);

            requestAnimationFrame(() => {
                textarea.selectionStart = selectionStart;
                textarea.selectionEnd = selectionStart;
                textarea.focus();
            });
            break;
        }
        case 'v': { // Paste
            const textFromClipboard = await navigator.clipboard.readText();
            const newCode = code.substring(0, start) + textFromClipboard + code.substring(end);
            const newCursorPosition = start + textFromClipboard.length;
            
            onCodeChange(newCode);

            requestAnimationFrame(() => {
                textarea.selectionStart = newCursorPosition;
                textarea.selectionEnd = newCursorPosition;
                textarea.focus();
            });
            break;
        }
      }
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
  }, [code, onCodeChange, onUndo, onRedo, ctrlActive, hasActiveFile]);

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
  
  const handleNativeKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveSuggestion(prev => (prev + 1) % suggestions.length);
          return;
      }
      if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length);
          return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          handleSuggestionSelection(suggestions[activeSuggestion]);
          return;
      }
      if (e.key === 'Escape') {
          setSuggestions([]);
          return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
            e.preventDefault();
            onUndo();
            return;
        }
        if (e.key.toLowerCase() === 'y') {
            e.preventDefault();
            onRedo();
            return;
        }
        if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'x') {
            // If no text is selected, select the whole line
            if (textarea.selectionStart === textarea.selectionEnd) {
                const currentCursor = textarea.selectionStart;
                const text = textarea.value;
                const lineStart = text.lastIndexOf('\n', currentCursor - 1) + 1;
                const lineEnd = text.indexOf('\n', currentCursor);
                const finalLineEnd = lineEnd === -1 ? text.length : lineEnd;

                // We set a timeout to allow the browser to select the text before the copy/cut command is executed.
                setTimeout(() => {
                    textarea.setSelectionRange(lineStart, finalLineEnd);
                }, 0)
            }
            // We do NOT preventDefault here, allowing the native copy/cut to proceed.
            return;
        }
        if (e.key.toLowerCase() === 'd') {
            e.preventDefault();
            if(hasActiveFile) {
                setShowDeleteConfirm(true);
            }
            return;
        }
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        handleKeyPress('Tab');
    }
  }, [onUndo, onRedo, hasActiveFile, handleKeyPress, suggestions, activeSuggestion, handleSuggestionSelection]);

  const showKeyboard = isKeyboardVisible;
  
  const editorStyles: React.CSSProperties = useMemo(() => ({
      fontFamily: 'var(--font-code)',
      fontSize: 'var(--editor-font-size)',
      lineHeight: '1.5',
      padding: '0.5rem 0.75rem',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      // @ts-ignore
      tabSize: 2,
  }), []);
  
  const highlightedCode = useMemo(() => {
    const lines = code.split('\n');
    return (
      <>
        {lines.map((line, lineIndex) => (
            <div key={lineIndex} className="min-h-[21px]" style={{minHeight: `${fontSize * 1.5}px`}}>
              {line === '' ? <>&nbsp;</> : parseCode(line).map((token, tokenIndex) => (
                  <span key={tokenIndex} className={getTokenClassName(token.type)}>
                    {token.value}
                  </span>
                ))}
            </div>
        ))}
      </>
    );
  }, [code, fontSize]);

  return (
    <>
      <Card className="flex flex-col h-full overflow-hidden shadow-lg min-h-[70vh]">
        <CardContent className="flex flex-col flex-grow p-0 bg-white dark:bg-gray-800">
          <div ref={editorContainerRef} className="flex flex-grow h-full">
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
                    onClick={() => {
                        setIsKeyboardVisible(true);
                        updateSuggestions();
                    }}
                    onKeyUp={updateSuggestions}
                    placeholder="Enter your JavaScript code here..."
                    className={cn(
                    "font-code text-base flex-grow w-full h-full resize-none rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 caret-black dark:caret-white",
                    "bg-transparent relative z-10"
                    )}
                    style={{...editorStyles, color: 'transparent'}}
                    spellCheck="false"
                />
                {suggestions.length > 0 && (
                  <AutocompleteDropdown 
                    suggestions={suggestions} 
                    top={suggestionPos.top} 
                    left={suggestionPos.left}
                    onSelect={handleSuggestionSelection}
                    activeIndex={activeSuggestion}
                  />
                )}
                <div 
                    ref={mirrorRef}
                    aria-hidden="true"
                    className="absolute top-0 left-0 invisible pointer-events-none"
                    style={{
                      ...editorStyles,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
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
        <CoderKeyboard 
            onKeyPress={handleKeyPress} 
            ctrlActive={ctrlActive} 
            onHide={() => setIsKeyboardVisible(false)}
            isSuggestionsOpen={suggestions.length > 0}
            onNavigateSuggestions={handleNavigateSuggestions}
            onSelectSuggestion={() => handleSuggestionSelection(suggestions[activeSuggestion])}
        />
      </div>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the current file.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                    onDeleteFile();
                    setShowDeleteConfirm(false);
                }}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const CodeEditor = React.memo(MemoizedCodeEditor);
