
'use client';

import React, { useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getTokenClassName, parseCode } from '@/lib/syntax-highlighter';

interface NoteCodeEditorProps {
    id: string;
    initialCode: string;
    onCodeChange: (code: string) => void;
    onFocus?: () => void;
    onKeyPress: (key: string) => void;
    isActive: boolean;
}

export const NoteCodeEditor: React.FC<NoteCodeEditorProps> = ({ id, initialCode, onCodeChange, onFocus, onKeyPress, isActive }) => {
    // This component is now controlled by the parent. 
    // The `initialCode` prop is the source of truth.
    const code = initialCode;
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const editorWrapperRef = useRef<HTMLDivElement>(null);

    const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onCodeChange(e.target.value);
    };

    const updateLineNumbersAndResize = useCallback(() => {
        const ta = textareaRef.current;
        const gutter = gutterRef.current;
        const mirror = mirrorRef.current;
        const wrapper = editorWrapperRef.current;
        if (!ta || !gutter || !mirror || !wrapper) return;

        // Use the current code value for calculations
        const currentCode = ta.value;
    
        const lines = currentCode.split('\n');
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
        if (isActive && (e.key === 'Enter' || e.key === 'Tab')) {
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
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
        paddingRight: '0.5rem',
        paddingLeft: '0rem', // No left padding on the editor itself
        boxSizing: 'border-box',
    };
    
    const gutterWidth = gutterRef.current?.offsetWidth || 0;

    return (
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
                onChange={handleCodeChange}
                onFocus={onFocus}
                onKeyDown={handleNativeKeyDown}
                inputMode={isActive ? 'none' : 'text'}
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
    );
};

    