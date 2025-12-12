

'use client';

import { Textarea } from '@/components/ui/textarea';
import React, from 'react';
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
import { getSmartIndentation } from '@/lib/indentation';
import { getTokenStyle, parseCode } from '@/lib/syntax-highlighter';

interface CodeEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteFile: () => void;
  hasActiveFile: boolean;
  onRun: () => void;
}

const MemoizedCodeEditor: React.FC<CodeEditorProps> = ({ code, onCodeChange, onUndo, onRedo, onDeleteFile, hasActiveFile, onRun }) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const gutterRef = React.useRef<HTMLDivElement>(null);
  const mirrorRef = React.useRef<HTMLDivElement>(null);
  const editorContainerRef = React.useRef<HTMLDivElement>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = React.useState(false);
  const isMobile = useIsMobile();
  const [ctrlActive, setCtrlActive] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const { settings, setSettings } = useSettings();
  const fontSize = settings.editorFontSize;
  const spacePressTimestampsRef = React.useRef<number[]>([]);

  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [suggestionPos, setSuggestionPos] = React.useState<Partial<React.CSSProperties>>({});
  const [activeSuggestion, setActiveSuggestion] = React.useState(0);
  const debouncedCode = useDebounce(code, 150);

  const updateSuggestions = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { suggestions: newSuggestions, word } = getSuggestions(code, textarea.selectionStart, isMobile);
    if (newSuggestions.length > 0) {
        setSuggestions(newSuggestions);
        setActiveSuggestion(0);
        
        const coords = getCaretCoordinates(textarea, textarea.selectionStart);
        const editorRect = textarea.getBoundingClientRect();
        const dropdownWidth = 200; // Approximate width of the dropdown
        const dropdownHeight = 200; // Approximate height of the dropdown

        let newPos: Partial<React.CSSProperties> = {};

        // Horizontal positioning
        if (coords.left + dropdownWidth > editorRect.width) {
            newPos.right = editorRect.width - coords.left;
        } else {
            newPos.left = coords.left;
        }
        
        // Vertical positioning
        if (coords.top + coords.height + dropdownHeight > editorRect.height) {
            newPos.bottom = editorRect.height - coords.top;
        } else {
            newPos.top = coords.top + coords.height;
        }

        setSuggestionPos(newPos);
    } else {
        setSuggestions([]);
    }
  }, [code, isMobile]);

  React.useEffect(() => {
    updateSuggestions();
  }, [debouncedCode, updateSuggestions]);


  const syncScroll = React.useCallback(() => {
    if (textareaRef.current && gutterRef.current && editorContainerRef.current) {
        const scrollTop = textareaRef.current.scrollTop;
        gutterRef.current.scrollTop = scrollTop;
    }
  }, []);

  const updateLineNumbers = React.useCallback(() => {
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


  React.useEffect(() => {
    updateLineNumbers();
    const handleResize = () => updateLineNumbers();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    }
  }, [code, updateLineNumbers, fontSize]);

  React.useEffect(() => {
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

  const handleSuggestionSelection = React.useCallback((suggestion: Suggestion) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { word, startPos } = getSuggestions(code, textarea.selectionStart, isMobile);
    
    const newCode = code.substring(0, startPos) + suggestion.value + code.substring(textarea.selectionStart);
    const newCursorPosition = startPos + suggestion.value.length;
    
    onCodeChange(newCode);
    setSuggestions([]);

    requestAnimationFrame(() => {
        textarea.selectionStart = newCursorPosition;
        textarea.selectionEnd = newCursorPosition;
        textarea.focus();
    });
  }, [code, onCodeChange, isMobile]);

  const handleNavigateSuggestions = React.useCallback((direction: 'next' | 'prev') => {
      if (suggestions.length === 0) return;
      if (direction === 'next') {
          setActiveSuggestion(prev => (prev + 1) % suggestions.length);
      } else {
          setActiveSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length);
      }
  }, [suggestions.length]);

  const handleEnterPress = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const { textToInsert, newCursorPosition } = getSmartIndentation(code, start, end);
    
    const newCode = code.substring(0, start) + textToInsert + code.substring(end);
    onCodeChange(newCode);
    
    requestAnimationFrame(() => {
        textarea.selectionStart = newCursorPosition;
        textarea.selectionEnd = newCursorPosition;
        textarea.focus();
    });
}, [code, onCodeChange]);

  const handleKeyPress = React.useCallback(async (key: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (key === 'Enter') {
        handleEnterPress();
        return;
    }

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
      case 'Tab':
        newCode = code.substring(0, start) + '    ' + code.substring(end);
        newCursorPosition = start + 4;
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
  }, [code, onCodeChange, onUndo, onRedo, ctrlActive, hasActiveFile, handleEnterPress]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const keyboard = document.getElementById('coder-keyboard');
      const target = event.target as Node;
      if (
        isMobile &&
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
  }, [isMobile]);
  
  const handleNativeKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

     if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '/') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (start === end) return;
        
        const selectedText = code.substring(start, end);
        const textBefore = code.substring(start - 2, start);
        const textAfter = code.substring(end, end + 2);

        let newCode;
        let newSelectionStart = start;
        let newSelectionEnd = end;

        if (textBefore === '/*' && textAfter === '*/') {
            // Unwrap
            newCode = code.substring(0, start - 2) + selectedText + code.substring(end + 2);
            newSelectionStart = start - 2;
            newSelectionEnd = end - 2;
        } else {
            // Wrap
            newCode = code.substring(0, start) + '/*' + selectedText + '*/' + code.substring(end);
            newSelectionStart = start;
            newSelectionEnd = end + 4;
        }
        
        onCodeChange(newCode);

        requestAnimationFrame(() => {
            textarea.selectionStart = newSelectionStart;
            textarea.selectionEnd = newSelectionEnd;
            textarea.focus();
        });
        return;
    }

     if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const lines = code.split('\n');
        
        let startLine = code.substring(0, start).split('\n').length - 1;
        let endLine = code.substring(0, end).split('\n').length - 1;

        if (end > 0 && code[end-1] === '\n') {
            endLine--;
        }

        const linesToToggle = lines.slice(startLine, endLine + 1);
        const areAllCommented = linesToToggle.every(line => line.trim().startsWith('//'));
        
        let newLines = [...lines];
        let charChange = 0;
        let firstLineChange = 0;

        for (let i = startLine; i <= endLine; i++) {
            if (areAllCommented) {
                const originalLine = newLines[i];
                newLines[i] = newLines[i].replace(/^\s*\/\/\s?/, '');
                const change = originalLine.length - newLines[i].length;
                if (i === startLine) firstLineChange = -change;
                charChange -= change;
            } else {
                newLines[i] = `// ${newLines[i]}`;
                if (i === startLine) firstLineChange = 3;
                charChange += 3;
            }
        }
        
        const newCode = newLines.join('\n');
        onCodeChange(newCode);

        requestAnimationFrame(() => {
            textarea.selectionStart = start + firstLineChange;
            textarea.selectionEnd = end + charChange;
            textarea.focus();
        });
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
        e.preventDefault();
        const currentPos = textarea.selectionStart;
        const textBefore = code.substring(0, currentPos);
        const reversedText = textBefore.split('').reverse().join('');
        
        const match = reversedText.match(/(\s+)|(\w+)|(\S)/);
        if (match) {
            const jumpTo = currentPos - (match.index || 0) - match[0].length;
            requestAnimationFrame(() => {
                textarea.selectionStart = jumpTo;
                textarea.selectionEnd = jumpTo;
            });
        }
        return;
    }

    if ((e.shiftKey || e.altKey) && e.key === ' ') {
        e.preventDefault();
        if (suggestions.length > 0) {
            // If suggestions are open, navigate them
            handleNavigateSuggestions('next');
        } else {
            // Otherwise, perform quick-jump
            const currentPos = textarea.selectionStart;
            const textAfter = code.substring(currentPos);
            
            if (textAfter.length > 0) {
                const match = textAfter.match(/(\s+)|(\w+)|(\S)/);
                if (match) {
                    const jumpTo = currentPos + (match.index || 0) + match[0].length;
                    requestAnimationFrame(() => {
                        textarea.selectionStart = jumpTo;
                        textarea.selectionEnd = jumpTo;
                    });
                }
            }
        }
        return;
    }

    // Smart pair deletion
    if (e.key === 'Backspace') {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (start === end && start > 0) { // No selection
            const charBefore = code.charAt(start - 1);
            const charAfter = code.charAt(start);
            const pairs: { [key: string]: string } = { '(': ')', '{': '}', '[': ']' };

            if (pairs[charBefore] === charAfter) {
                e.preventDefault();
                const newCode = code.substring(0, start - 1) + code.substring(start + 1);
                onCodeChange(newCode);
                
                requestAnimationFrame(() => {
                    textarea.selectionStart = start - 1;
                    textarea.selectionEnd = start - 1;
                    textarea.focus();
                });
                return;
            }
        }
    }

    if (e.key === ' ') {
        const now = Date.now();
        spacePressTimestampsRef.current.push(now);
        if (spacePressTimestampsRef.current.length > 3) {
            spacePressTimestampsRef.current.shift();
        }

        if (spacePressTimestampsRef.current.length === 3) {
            const [first, second, third] = spacePressTimestampsRef.current;
            if (third - first < 500) { // Triple press within 500ms
                const cursorPosition = textarea.selectionStart;
                const nextChar = code[cursorPosition];
                const closingSymbols = [')', '}', ']', "'", '"', '`'];
                if (closingSymbols.includes(nextChar)) {
                    e.preventDefault();
                    const newCursorPosition = cursorPosition + 1;
                    requestAnimationFrame(() => {
                        textarea.selectionStart = newCursorPosition;
                        textarea.selectionEnd = newCursorPosition;
                        textarea.focus();
                    });
                    spacePressTimestampsRef.current = []; // Reset after jump
                    return;
                }
            }
        }
    } else {
        spacePressTimestampsRef.current = [];
    }


    if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        onRun();
        return;
    }

    if (suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleNavigateSuggestions('next');
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleNavigateSuggestions('prev');
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

    if (e.key === 'Enter') {
      e.preventDefault();
      handleEnterPress();
      return;
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
            if (textarea.selectionStart === textarea.selectionEnd) {
                const currentCursor = textarea.selectionStart;
                const text = textarea.value;
                const lineStart = text.lastIndexOf('\n', currentCursor - 1) + 1;
                const lineEnd = text.indexOf('\n', currentCursor);
                const finalLineEnd = lineEnd === -1 ? text.length : lineEnd;

                setTimeout(() => {
                    textarea.setSelectionRange(lineStart, finalLineEnd);
                }, 0)
            }
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
        return;
    }
    
    const pairMap: {[key:string]: string} = {
        '(': ')',
        '{': '}',
        '[': ']',
        "'": "'",
        '"': '"',
        '`': '`',
    };

    if (pairMap[e.key]) {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const open = e.key;
        const close = pairMap[e.key];
        
        let newCode;
        let newCursorPosition;

        if (start === end) { // No selection
            newCode = code.substring(0, start) + open + close + code.substring(end);
            newCursorPosition = start + 1;
        } else { // Selection exists
            const selectedText = code.substring(start, end);
            newCode = code.substring(0, start) + open + selectedText + close + code.substring(end);
            newCursorPosition = start + open.length + selectedText.length + close.length;
        }
        
        onCodeChange(newCode);

        requestAnimationFrame(() => {
          if (start === end) {
            textarea.selectionStart = newCursorPosition;
            textarea.selectionEnd = newCursorPosition;
          } else {
            textarea.selectionStart = start + open.length;
            textarea.selectionEnd = end + open.length;
          }
          textarea.focus();
        });
        return;
    }

  }, [onRun, onUndo, onRedo, hasActiveFile, handleKeyPress, suggestions, activeSuggestion, handleSuggestionSelection, handleEnterPress, code, onCodeChange, handleNavigateSuggestions]);

  const showKeyboard = isMobile && isKeyboardVisible && settings.isVirtualKeyboardEnabled;
  
  const handleEditorClick = () => {
    if (isMobile && settings.isVirtualKeyboardEnabled) {
      setIsKeyboardVisible(true);
      updateSuggestions();
    }
  }

  const editorStyles: React.CSSProperties = React.useMemo(() => ({
      fontFamily: 'var(--font-code)',
      fontSize: 'var(--editor-font-size)',
      lineHeight: '1.5',
      padding: '0.5rem 0.75rem',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      // @ts-ignore
      tabSize: 4,
  }), []);
  
  const highlightedCode = React.useMemo(() => {
    const { tokens } = parseCode(code);
    return (
        <>
            {tokens.map((token, tokenIndex) => (
                <span key={tokenIndex} style={getTokenStyle(token.type)}>
                    {token.value}
                </span>
            ))}
        </>
    );
}, [code]);

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
                    onClick={handleEditorClick}
                    onFocus={handleEditorClick}
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
                    {...suggestionPos}
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
      {isMobile && showKeyboard && (
        <div id="coder-keyboard" className={cn(
          "fixed bottom-0 left-0 right-0 transition-transform duration-300 ease-in-out z-[999]",
          showKeyboard ? "translate-y-0" : "translate-y-full"
        )}>
          <CoderKeyboard 
              onKeyPress={handleKeyPress} 
              ctrlActive={ctrlActive} 
              onHide={() => {
                setIsKeyboardVisible(false);
                setSettings({...settings, isVirtualKeyboardEnabled: false});
              }}
              isSuggestionsOpen={suggestions.length > 0}
              onNavigateSuggestions={handleNavigateSuggestions}
              onSelectSuggestion={() => handleSuggestionSelection(suggestions[activeSuggestion])}
          />
        </div>
      )}
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

    
