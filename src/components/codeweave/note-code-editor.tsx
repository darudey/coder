

'use client';

import React, { useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getTokenStyle, parseCode } from '@/lib/syntax-highlighter';
import { CoderKeyboard } from '@/components/codeweave/coder-keyboard';
import { useIsMobile } from '@/hooks/use-mobile';
import { getSmartIndentation } from '@/lib/indentation';

interface NoteCodeEditorProps {
    code: string;
    onCodeChange: (newCode: string) => void;
}

export const NoteCodeEditor = React.forwardRef<HTMLTextAreaElement, NoteCodeEditorProps>(({ code, onCodeChange }, ref) => {
    const isMobile = useIsMobile();
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [ctrlActive, setCtrlActive] = useState(false);
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const editorWrapperRef = useRef<HTMLDivElement>(null);

    const handleCodeChange = (newCode: string) => {
        onCodeChange(newCode);
    };

    const undo = useCallback(() => {
        // This would require a more complex state management in the parent component.
        // For now, we rely on browser undo/redo.
        document.execCommand('undo');
    }, []);

    const redo = useCallback(() => {
        document.execCommand('redo');
    }, []);


    const handleEnterPress = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        const { textToInsert, newCursorPosition } = getSmartIndentation(code, start, end);
    
        const newCode = code.substring(0, start) + textToInsert + code.substring(end);
        handleCodeChange(newCode);
        
        requestAnimationFrame(() => {
            textarea.selectionStart = newCursorPosition;
            textarea.selectionEnd = newCursorPosition;
            textarea.focus();
        });
    }, [code, handleCodeChange]);

    const handleKeyPress = useCallback(async (key: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        if (key === 'Enter') {
            document.execCommand('insertParagraph');
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
                undo();
                break;
            case 'y':
                redo();
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
                handleCodeChange(newCode);

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
                
                handleCodeChange(newCode);

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

        handleCodeChange(newCode);

        requestAnimationFrame(() => {
          textarea.selectionStart = newCursorPosition;
          textarea.selectionEnd = newCursorPosition;
          textarea.focus();
        });
    }, [code, handleEnterPress, ctrlActive, undo, redo, handleCodeChange]);
    
    const handleNativeKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        if (e.key === 'Enter') {
          e.preventDefault();
          handleEnterPress();
          return;
        }

        if (e.ctrlKey || e.metaKey) {
            if (e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
                return;
            }
            if (e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
                return;
            }
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            handleKeyPress('Tab');
        }
      }, [undo, redo, handleKeyPress, handleEnterPress]);

    const updateLineNumbersAndResize = useCallback(() => {
        const ta = textareaRef.current;
        const gutter = gutterRef.current;
        const mirror = mirrorRef.current;
        const wrapper = editorWrapperRef.current;
        if (!ta || !gutter || !mirror || !wrapper) return;
    
        const lines = code.split('\n');
        gutter.innerHTML = '';
        mirror.innerHTML = '';
    
        lines.forEach(line => {
            const lineEl = document.createElement('div');
            lineEl.textContent = line || ' ';
            mirror.appendChild(lineEl);
        });
    
        let totalHeight = 0;
        Array.from(mirror.children).forEach((child, i) => {
            const h = (child as HTMLElement).offsetHeight;
            totalHeight += h;
            const gutterLine = document.createElement('div');
            gutterLine.className = 'flex items-start h-full';
            gutterLine.textContent = String(i + 1);
            gutterLine.style.height = `${h}px`;
            gutter.appendChild(gutterLine);
        });
    
        const newGutterWidth = (String(lines.length).length * 8 + 16);
        gutter.style.width = `${newGutterWidth}px`;
        
        const computedStyle = getComputedStyle(ta);
        const paddingTop = parseFloat(computedStyle.paddingTop);
        const paddingBottom = parseFloat(computedStyle.paddingBottom);
        const totalPadding = paddingTop + paddingBottom;
    
        const newHeight = Math.max(totalHeight + totalPadding, 21);
        wrapper.style.height = `${newHeight}px`;
    
    }, [code]);
    
    const syncScroll = useCallback(() => {
        if (textareaRef.current && gutterRef.current) {
            const scrollTop = textareaRef.current.scrollTop;
            gutterRef.current.scrollTop = scrollTop;
            const highlightDiv = textareaRef.current?.previousSibling as HTMLDivElement;
            if (highlightDiv) {
                highlightDiv.scrollTop = scrollTop;
            }
        }
    }, []);

    useLayoutEffect(() => {
        updateLineNumbersAndResize();
    }, [code, updateLineNumbersAndResize]);
    
    const highlightedCode = React.useMemo(() => {
        const lines = code.split('\n');
        return (
            <>
                {lines.map((line, lineIndex) => (
                    <div key={lineIndex} className="min-h-[21px]">
                        {line === '' ? <>&nbsp;</> : parseCode(line).map((token, tokenIndex) => (
                            <span key={tokenIndex} style={getTokenStyle(token.type)}>
                                {token.value}
                            </span>
                        ))}
                    </div>
                ))}
            </>
        );
    }, [code]);

    const editorStyles: React.CSSProperties = {
        fontFamily: 'var(--font-code)',
        fontSize: '14px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        padding: '0.5rem',
        boxSizing: 'border-box',
    };
    
    const gutterWidth = gutterRef.current?.offsetWidth || 0;
    const showKeyboard = isMobile && isKeyboardVisible;

    return (
        <>
            <div ref={editorWrapperRef} className="relative group border rounded-md overflow-hidden">
                <div 
                    ref={gutterRef}
                    className="absolute top-0 left-0 h-full box-border pr-1 text-right text-gray-500 bg-gray-100 border-r select-none dark:bg-gray-900 dark:border-gray-700"
                    style={{
                        ...editorStyles,
                        paddingLeft: '0.5rem', 
                        paddingRight: '0.5rem', 
                        borderRight: '1px solid hsl(var(--border))',
                        overflowY: 'hidden',
                    }}
                />
                <div 
                    className="absolute top-0 left-0 w-full h-full overflow-y-scroll"
                    style={{...editorStyles, left: `${gutterWidth}px`, scrollbarWidth: 'none'}}
                >
                    <div
                        aria-hidden="true"
                        className="pointer-events-none"
                        style={{...editorStyles, paddingTop: 0, paddingBottom: 0, paddingRight: 0, paddingLeft: 0}}
                    >
                        {highlightedCode}
                    </div>
                </div>
                <Textarea
                    ref={textareaRef}
                    value={code}
                    inputMode={isMobile ? 'none' : 'text'}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    onKeyDown={handleNativeKeyDown}
                    onScroll={syncScroll}
                    onFocus={() => { if(isMobile) setIsKeyboardVisible(true) }}
                    onClick={() => { if(isMobile) setIsKeyboardVisible(true) }}
                    className={cn(
                        "font-code text-sm resize-none",
                        "absolute inset-0 w-full h-full bg-transparent z-10",
                        "caret-black dark:caret-white"
                    )}
                    style={{
                        ...editorStyles, 
                        color: 'transparent',
                        border: 'none', 
                        overflowY: 'auto',
                        paddingLeft: `${gutterWidth + 8}px`,
                        outline: 'none',
                        boxShadow: 'none'
                    }}
                    spellCheck="false"
                />
                <div 
                    ref={mirrorRef}
                    aria-hidden="true"
                    className="absolute top-0 left-0 invisible pointer-events-none"
                    style={{
                        ...editorStyles,
                        left: `${gutterWidth}px`,
                        width: `calc(100% - ${gutterWidth}px)`,
                        paddingLeft: '0.5rem'
                    }}
                />
            </div>
            {showKeyboard && <div id="coder-keyboard" className={cn(
                "fixed bottom-0 left-0 right-0 z-[999] transition-transform duration-300 ease-in-out",
                isKeyboardVisible ? "translate-y-0" : "translate-y-full"
            )}>
                <CoderKeyboard 
                    onKeyPress={handleKeyPress}
                    ctrlActive={ctrlActive}
                    onHide={() => setIsKeyboardVisible(false)}
                    isSuggestionsOpen={false}
                    onNavigateSuggestions={() => {}}
                    onSelectSuggestion={() => {}}
                />
            </div>}
        </>
    );
});
NoteCodeEditor.displayName = 'NoteCodeEditor';
