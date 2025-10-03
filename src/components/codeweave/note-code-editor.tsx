
'use client';

import React, { useState, useCallback, useRef, useLayoutEffect, useEffect, useImperativeHandle } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getTokenClassName, parseCode } from '@/lib/syntax-highlighter';
import { CoderKeyboard } from './coder-keyboard';
import { useIsMobile } from '@/hooks/use-mobile';
import { getSmartIndentation } from '@/lib/indentation';

export interface NoteCodeEditorRef {
  getValue: () => string;
}

interface NoteCodeEditorProps {
    id: string;
    initialCode: string;
    onContentChange: () => void;
}

export const NoteCodeEditor = React.forwardRef<NoteCodeEditorRef, NoteCodeEditorProps>(({ id, initialCode, onContentChange }, ref) => {
    const [code, setCode] = useState(initialCode);
    const isMobile = useIsMobile();
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [ctrlActive, setCtrlActive] = useState(false);
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const editorWrapperRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        getValue: () => code,
    }));

    useEffect(() => {
        setCode(initialCode);
    }, [initialCode]);

    const handleCodeChange = (newCode: string) => {
        setCode(newCode);
        onContentChange();
    };

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
    }, [code]);

    const handleKeyPress = useCallback(async (key: string) => {
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

        // Basic handling for other keys, can be expanded
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        let newCode = code;
        let newCursorPosition = start;
        
        if (key === 'Backspace') {
            if (start === end && start > 0) {
              newCode = code.substring(0, start - 1) + code.substring(end);
              newCursorPosition = start - 1;
            } else {
              newCode = code.substring(0, start) + code.substring(end);
              newCursorPosition = start;
            }
        } else if (key === 'Tab') {
            newCode = code.substring(0, start) + '  ' + code.substring(end);
            newCursorPosition = start + 2;
        } else if (!['Shift', 'CapsLock'].includes(key)){
            const pairMap: {[key:string]: string} = { '(': ')', '{': '}', '[': ']', "'": "'", '"': '"', '`': '`' };
            if (pairMap[key] && key.length === 1) {
                newCode = code.substring(0, start) + key + pairMap[key] + code.substring(end);
                newCursorPosition = start + 1;
            } else {
                newCode = code.substring(0, start) + key + code.substring(end);
                newCursorPosition = start + key.length;
            }
        } else {
            return;
        }

        handleCodeChange(newCode);

        requestAnimationFrame(() => {
          textarea.selectionStart = newCursorPosition;
          textarea.selectionEnd = newCursorPosition;
          textarea.focus();
        });
    }, [code, handleEnterPress]);

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
                            <span key={tokenIndex} className={getTokenClassName(token.type)}>
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
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
        paddingRight: '0.5rem',
        paddingLeft: '0rem', // No left padding on the editor itself
        boxSizing: 'border-box',
    };
    
    const gutterWidth = gutterRef.current?.offsetWidth || 0;
    const showKeyboard = isMobile && isKeyboardVisible;

    return (
        <>
            <div ref={editorWrapperRef} className="relative group">
                <div 
                    ref={gutterRef}
                    className="absolute top-0 left-0 h-full box-border pr-1 text-right text-gray-500 bg-gray-100 border-r select-none dark:bg-gray-900 dark:border-gray-700"
                    style={{
                        ...editorStyles,
                        paddingLeft: '0.5rem', 
                        paddingRight: '0.5rem', 
                        borderRight: '1px solid hsl(var(--border))'
                    }}
                />
                <div
                    aria-hidden="true"
                    className="absolute inset-0 m-0 pointer-events-none"
                    style={{...editorStyles, left: `${gutterWidth}px`, paddingLeft: '0.5rem' }}
                >
                    {highlightedCode}
                </div>
                <Textarea
                    id={id}
                    ref={textareaRef}
                    value={code}
                    inputMode={isMobile ? 'none' : 'text'}
                    onChange={(e) => handleCodeChange(e.target.value)}
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
                        left: `${gutterWidth}px`, 
                        overflow: 'hidden', 
                        paddingLeft: '0.5rem',
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
                "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out",
                isKeyboardVisible ? "translate-y-0" : "translate-y-full"
            )}>
                <CoderKeyboard 
                    onKeyPress={handleKeyPress}
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

    