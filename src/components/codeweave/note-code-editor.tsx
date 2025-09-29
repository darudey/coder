
'use client';

import React, { useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getTokenClassName, parseCode } from '@/lib/syntax-highlighter';

interface NoteCodeEditorProps {
    initialCode: string;
    onCodeChange: (code: string) => void;
}

export const NoteCodeEditor: React.FC<NoteCodeEditorProps> = ({ initialCode, onCodeChange }) => {
    const [code, setCode] = useState(initialCode);
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const editorWrapperRef = useRef<HTMLDivElement>(null);

    // Update internal state if the initialCode prop changes from outside
    useEffect(() => {
        setCode(initialCode);
    }, [initialCode]);

    const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCode(e.target.value);
    };

    const handleBlur = () => {
        onCodeChange(code);
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
        ta.style.paddingLeft = `${newGutterWidth + 8}px`;

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
    };

    return (
        <div ref={editorWrapperRef} className="relative group">
            <div 
                ref={gutterRef}
                className="absolute top-0 left-0 h-full box-border p-2 pr-1 text-right text-gray-500 bg-gray-100 border-r select-none dark:bg-gray-900 dark:border-gray-700"
                style={{...editorStyles, paddingTop: '0.5rem', paddingBottom: '0.5rem'}}
            />
            <div
                aria-hidden="true"
                className="absolute inset-0 m-0 pointer-events-none"
                style={{...editorStyles, padding: '0.5rem 0.75rem', paddingLeft: '48px' }}
            >
                {highlightedCode}
            </div>
             <Textarea
                ref={textareaRef}
                value={code}
                onChange={handleCodeChange}
                onBlur={handleBlur}
                className={cn(
                    "font-code text-sm rounded-none border-0 border-b focus-visible:ring-0 focus-visible:ring-offset-0 overflow-hidden resize-none",
                    "absolute inset-0 w-full h-full bg-transparent text-transparent caret-black dark:caret-white z-10"
                )}
                style={{...editorStyles, padding: '0.5rem 0.75rem', paddingLeft: '48px'}}
                spellCheck="false"
            />
             <div 
                ref={mirrorRef}
                aria-hidden="true"
                className="absolute top-0 left-0 invisible pointer-events-none"
                style={{
                    ...editorStyles,
                    padding: '0.5rem 0.75rem',
                    paddingLeft: '48px',
                    boxSizing: 'border-box',
                    width: '100%',
                }}
            />
        </div>
    );
};
