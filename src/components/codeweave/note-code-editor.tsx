
'use client';

import React, { useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getTokenClassName, parseCode } from '@/lib/syntax-highlighter';

interface NoteCodeEditorProps {
    initialCode: string;
    onCodeChange: (code: string) => void;
    onFocus?: () => void;
    onKeyPress: (key: string) => void;
    isActive: boolean;
}

export const NoteCodeEditor: React.FC<NoteCodeEditorProps> = ({ initialCode, onCodeChange, onFocus, onKeyPress, isActive }) => {
    const [code, setCode] = useState(initialCode);
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const editorWrapperRef = useRef<HTMLDivElement>(null);

    // Update internal state if the initialCode prop changes from outside
    useEffect(() => {
        if (initialCode !== code) {
          setCode(initialCode);
        }
    }, [initialCode]);

    const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCode(e.target.value);
        onCodeChange(e.target.value);
    };

    const updateLineNumbersAndResize = useCallback(() => {
        const ta = textareaRef.current;
        const gutter = gutterRef.current;
        const mirror = mirrorRef.current;
        const wrapper = editorWrapperRef.current;
        if (!ta || !gutter || !mirror || !wrapper) return;
    
        const lines = ta.value.split('\n');
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
    
    }, []);

    useLayoutEffect(() => {
        updateLineNumbersAndResize();
    }, [code, updateLineNumbersAndResize]);
    
    const handleNativeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            onKeyPress(e.key);
        }
    };

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
        padding: '0.5rem',
        boxSizing: 'border-box',
    };

    return (
        <div ref={editorWrapperRef} className="relative group border-y">
            <div 
                ref={gutterRef}
                className="absolute top-0 left-0 h-full box-border pr-1 text-right text-gray-500 bg-gray-100 border-r select-none dark:bg-gray-900 dark:border-gray-700"
                style={{...editorStyles, borderRight: '1px solid hsl(var(--border))'}}
            />
            <div
                aria-hidden="true"
                className="absolute inset-0 m-0 pointer-events-none"
                style={{...editorStyles, left: '48px' }}
            >
                {highlightedCode}
            </div>
             <Textarea
                ref={textareaRef}
                value={code}
                onChange={handleCodeChange}
                onFocus={onFocus}
                onKeyDown={isActive ? handleNativeKeyDown : undefined}
                inputMode={isActive ? 'none' : 'text'}
                className={cn(
                    "font-code text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0",
                    "absolute inset-0 w-full h-full bg-transparent z-10",
                    "caret-black dark:caret-white"
                )}
                style={{...editorStyles, color: 'transparent', border: 'none', left: '48px', overflow: 'hidden'}}
                spellCheck="false"
            />
             <div 
                ref={mirrorRef}
                aria-hidden="true"
                className="absolute top-0 left-0 invisible pointer-events-none"
                style={{
                    ...editorStyles,
                    left: '48px',
                    width: 'calc(100% - 48px)',
                }}
            />
        </div>
    );
};
