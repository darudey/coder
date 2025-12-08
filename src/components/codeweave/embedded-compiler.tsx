

'use client';

import React, { useState, useCallback, useRef, useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { DotLoader } from './dot-loader';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import AnsiToHtml from '@/lib/ansi-to-html';
import type { RunResult } from './compiler';
import { getTokenStyle, parseCode } from '@/lib/syntax-highlighter';

interface EmbeddedCompilerProps {
    initialCode: string;
}

const runCodeOnClient = (code: string): Promise<RunResult> => {
    return new Promise((resolve) => {
        if (typeof window === 'undefined') {
            resolve({ output: '', type: 'result' });
            return;
        }
        const worker = new Worker('/runner.js');
        const timeout = setTimeout(() => {
            worker.terminate();
            resolve({
                output: 'Execution timed out. Your code may have an infinite loop.',
                type: 'error',
            });
        }, 3000);

        worker.onmessage = (e) => {
            clearTimeout(timeout);
            worker.terminate();
            resolve(e.data);
        };

        worker.onerror = (e) => {
            clearTimeout(timeout);
            worker.terminate();
            resolve({
                output: `Worker error: ${e.message}`,
                type: 'error',
            });
        };

        worker.postMessage({ code });
    });
};

export const EmbeddedCompiler: React.FC<EmbeddedCompilerProps> = ({ initialCode }) => {
    const [output, setOutput] = useState<RunResult | null>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    
    const outputRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const editorWrapperRef = useRef<HTMLDivElement>(null);

    const updateLineNumbersAndResize = useCallback(() => {
        const ta = textareaRef.current;
        const gutter = gutterRef.current;
        const mirror = mirrorRef.current;
        const wrapper = editorWrapperRef.current;
        if (!ta || !gutter || !mirror || !wrapper) return;
    
        const lines = initialCode.split('\n');
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
    
    }, [initialCode]);

    useLayoutEffect(() => {
        updateLineNumbersAndResize();
    }, [initialCode, updateLineNumbersAndResize]);

    const handleRun = useCallback(async () => {
        setIsCompiling(true);
        setOutput(null);
        const result = await runCodeOnClient(initialCode);
        setOutput(result);
        setIsCompiling(false);
        setTimeout(() => {
            outputRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }, [initialCode]);

    const highlightedCode = React.useMemo(() => {
        const lines = initialCode.split('\n');
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
    }, [initialCode]);

    const editorStyles: React.CSSProperties = {
        fontFamily: 'var(--font-code)',
        fontSize: '14px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
    };

    return (
        <div className="my-4 border rounded-lg overflow-hidden not-prose bg-background">
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
                    value={initialCode}
                    readOnly
                    className={cn(
                        "font-code text-sm rounded-none border-0 border-b focus-visible:ring-0 focus-visible:ring-offset-0 overflow-hidden resize-none",
                        "absolute inset-0 w-full h-full bg-transparent text-transparent caret-transparent z-10"
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
                <Button 
                    onClick={handleRun} 
                    disabled={isCompiling} 
                    size="sm" 
                    className="absolute top-2 right-2 h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                    {isCompiling ? (
                        <DotLoader />
                    ) : (
                        <>
                            <Play className="w-3 h-3" />
                            <span className="ml-1.5 text-xs">Run</span>
                        </>
                    )}
                </Button>
            </div>
            {(output || isCompiling) && (
                <div ref={outputRef} className="p-3 text-xs font-code bg-muted/50">
                    <ScrollArea className="max-h-40">
                        {isCompiling && (
                             <div className="flex items-center text-muted-foreground">
                                <DotLoader className="w-8" />
                                <span className="ml-2">Running...</span>
                             </div>
                        )}
                        {output && (
                            <pre
                                className={cn(
                                    "whitespace-pre-wrap",
                                    output.type === 'error' ? 'text-red-500' : 'text-foreground'
                                )}
                                dangerouslySetInnerHTML={{ __html: AnsiToHtml(output.output) }}
                            />
                        )}
                    </ScrollArea>
                </div>
            )}
        </div>
    );
};
