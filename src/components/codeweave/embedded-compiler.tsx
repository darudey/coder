
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

interface EmbeddedCompilerProps {
    initialCode: string;
}

const runCodeOnClient = (code: string): Promise<RunResult> => {
    return new Promise((resolve) => {
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
    const [code, setCode] = useState(initialCode);
    const [output, setOutput] = useState<RunResult | null>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const outputRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const resizeTextarea = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }

    useLayoutEffect(() => {
        resizeTextarea();
    }, [code]);

    const handleRun = useCallback(async () => {
        setIsCompiling(true);
        setOutput(null);
        const result = await runCodeOnClient(code);
        setOutput(result);
        setIsCompiling(false);
        setTimeout(() => {
            outputRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }, [code]);

    return (
        <div className="my-4 border rounded-lg overflow-hidden not-prose bg-background">
            <div className="relative group">
                <Textarea
                    ref={textareaRef}
                    value={code}
                    onChange={(e) => {
                        setCode(e.target.value);
                    }}
                    className="font-code text-sm rounded-none border-0 border-b focus-visible:ring-0 focus-visible:ring-offset-0 bg-white dark:bg-gray-800 overflow-hidden resize-none"
                    spellCheck="false"
                />
                <Button 
                    onClick={handleRun} 
                    disabled={isCompiling} 
                    size="sm" 
                    className="absolute top-2 right-2 h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
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
