
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DotLoader } from './dot-loader';
import { cn } from '@/lib/utils';
import { diffLines } from 'diff';
import { Copy, Check, X, Activity } from 'lucide-react';
import Prism from 'prismjs';
// Do not import prism-json directly here, it will be loaded dynamically.
import 'prismjs/themes/prism-tomorrow.css'; // Using a standard theme

// Types
import type { RunResult } from './compiler';

/* ------------------- Helpers ------------------- */
const getErrorLine = (output: RunResult | null): string | null => {
    if (!output || output.type !== 'error' || !output.output[0]?.[0]) return null;
    const errorMessage = output.output[0][0];

    const match = errorMessage.match(/at line (\d+)/);
    if (match && match[1]) {
        return match[1];
    }
    
    const anotherMatch = errorMessage.match(/<anonymous>:(\d+):(\d+)/);
    if (anotherMatch && anotherMatch[1]) {
      const lineNumber = parseInt(anotherMatch[1], 10);
      if (!isNaN(lineNumber) && lineNumber > 2) {
        return (lineNumber - 2).toString();
      }
      return anotherMatch[1];
    }
    return null;
  };


const detectBeginnerIssues = (output: RunResult | null) => {
  if (!output || output.type !== 'error' || !output.output[0]?.[0]) return [];
  const text = output.output[0][0];

  const issues: string[] = [];
  if (/while\s*\(true\)|for\s*\(;\s*;\s*\)/.test(text)) {
    issues.push('Possible infinite loop detected (while(true) or for(;;)).');
  }
  if (/ReferenceError:|is not defined/.test(text)) {
    issues.push('Reference error: a variable may be undefined.');
  }
  if (/SyntaxError:/.test(text)) {
    issues.push('Syntax error detected. Check braces, parentheses and commas.');
  }
  if (/Maximum call stack size exceeded/.test(text)) {
    issues.push('Possible recursion causing stack overflow.');
  }
  return issues;
};

/* ------------------- Subcomponents ------------------- */

const LoadingState = React.memo(({ isAiChecking }: { isAiChecking?: boolean }) => (
  <div className="flex items-center justify-center h-full">
    {isAiChecking ? (
      <>
        <p className="mr-4 text-muted-foreground">AI is analyzing your code...</p>
        <DotLoader className="w-12 text-primary" />
      </>
    ) : (
      <>
        <DotLoader className="w-12 text-primary" />
        <p className="ml-4 text-muted-foreground">Running code...</p>
      </>
    )}
  </div>
));
LoadingState.displayName = 'LoadingState';

const HeaderBar: React.FC<{
  onCopy: () => Promise<void>;
  copied: boolean;
  runTime?: number | null;
  issues: string[];
  isError?: boolean;
  passed?: boolean | null;
}> = ({ onCopy, copied, runTime, issues, isError, passed }) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b">
      <div className="flex items-center gap-3">
        {typeof runTime === 'number' && (
          <div className="text-xs text-muted-foreground">Execution: {runTime.toFixed(2)}ms</div>
        )}
        {isError && <div className="text-xs text-destructive">Error</div>}
        {passed !== null && typeof passed !== 'undefined' && (
          <div className={cn('text-xs font-semibold', passed ? 'text-green-600' : 'text-red-600')}>
            {passed ? 'Matches expected' : 'Mismatch'}
          </div>
        )}
      </div>

      <kbd className="h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 hidden md:inline-flex">
        <span className="text-xs">Shift</span>+<span className="text-xs">Enter</span>
      </kbd>

      <div className="flex items-center gap-2">
        {issues.length > 0 && (
          <div className="text-xs text-amber-600">⚠️ {issues.length} issue(s)</div>
        )}
        <button
          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted"
          onClick={onCopy}
          aria-label="Copy output"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span className="text-xs text-muted-foreground">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
};

HeaderBar.displayName = 'HeaderBar';

const OutputLine: React.FC<{ args: any[], type: 'result' | 'error' }> = ({ args, type }) => {
    const formattedArgs = args.map((arg, i) => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                const jsonString = JSON.stringify(arg, null, 2);
                const highlighted = Prism.highlight(jsonString, Prism.languages.json, 'json');
                return <pre key={i} className="inline whitespace-pre-wrap break-all" dangerouslySetInnerHTML={{ __html: highlighted }} />;
            } catch (e) {
                return <span key={i}>[Circular Object]</span>;
            }
        }
        return <span key={i}>{String(arg)}</span>;
    });

    return (
        <div className={cn('font-code flex-1', type === 'error' ? 'text-red-500' : 'text-foreground')}>
            {formattedArgs.map((arg, i) => (
                <React.Fragment key={i}>
                    {i > 0 && ' '}
                    {arg}
                </React.Fragment>
            ))}
        </div>
    )
}

const OutputBlock: React.FC<{
  outputLines: any[][];
  type: 'result' | 'error';
}> = ({ outputLines, type }) => {
  if (!outputLines || outputLines.length === 0) {
      return null;
  }

  return (
    <div className="h-full flex flex-col">
        <ScrollArea className="flex-grow">
            <div className="px-4 py-3 space-y-2">
                {outputLines.map((args, i) => (
                    <div className="flex min-w-0" key={i}>
                        <div className="select-none pr-4 text-xs text-muted-foreground tabular-nums">{i + 1}</div>
                        <OutputLine args={args} type={type} />
                    </div>
                ))}
            </div>
        </ScrollArea>
    </div>
  );
};
OutputBlock.displayName = 'OutputBlock';

/* ------------------- Main Component ------------------- */
interface OutputDisplayProps {
    output: RunResult | null;
    isCompiling: boolean;
    isAiChecking?: boolean;
    expectedOutput?: string;
}


const MemoizedOutputDisplay: React.FC<OutputDisplayProps> = ({
  output,
  isCompiling,
  isAiChecking,
  expectedOutput,
}) => {
  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef<number | null>(null);

  useEffect(() => {
    // Dynamically import prism components to ensure Prism is defined.
    try {
      if (typeof window !== 'undefined' && !Prism.languages.json) {
        import('prismjs/components/prism-json');
      }
    } catch(e) {
        console.error(e);
    }
  }, []);

  useEffect(() => () => {
    if (copyTimeout.current) window.clearTimeout(copyTimeout.current);
  }, []);

  const runTime = output?.durationMs;

  const issues = useMemo(() => detectBeginnerIssues(output), [output]);
  
  const userOutputText = useMemo(() => {
    if (!output) return '';
    return output.output.map(line => line.map(arg => {
        if (typeof arg === 'object' && arg !== null) return JSON.stringify(arg);
        return String(arg);
    }).join(' ')).join('\n');
  }, [output]);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(userOutputText);
      setCopied(true);
      if (copyTimeout.current) window.clearTimeout(copyTimeout.current);
      copyTimeout.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy to clipboard');
    }
  }, [userOutputText]);

  // Loading
  if (isCompiling) return <LoadingState isAiChecking={isAiChecking} />;

  // Empty
  if (!output)
    return (
      <p className="text-muted-foreground p-4">Click "Run" to execute the code and see the output here.</p>
    );

  const outputType = (output as any).type ?? 'result';

  const errorLine = getErrorLine(output);

  // pass/fail detection for expected output
  const passed = typeof expectedOutput === 'string' ? expectedOutput.trim() === userOutputText.trim() : null;

  /* ------------- Render with enhanced UI ------------- */
  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-none border-0">
      <HeaderBar
        onCopy={onCopy}
        copied={copied}
        runTime={runTime}
        issues={issues}
        isError={outputType === 'error'}
        passed={passed}
      />
      <CardContent className="flex-grow p-0 overflow-hidden h-full">
        <div className="h-full flex flex-col">
          {expectedOutput ? (
            <Tabs defaultValue="user" className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="user">Your Output</TabsTrigger>
                <TabsTrigger value="required">Required Output</TabsTrigger>
                <TabsTrigger value="diff">Diff</TabsTrigger>
              </TabsList>

              <TabsContent value="user" className="flex-grow overflow-hidden mt-0">
                <div className="h-full">
                    {errorLine && (
                      <div className="m-4 text-sm font-semibold text-destructive/80">Error on line {errorLine}</div>
                    )}
                    <OutputBlock outputLines={output.output} type={outputType} />
                </div>
              </TabsContent>

              <TabsContent value="required" className="flex-grow overflow-hidden mt-0">
                  <div className="h-full">
                    <OutputBlock outputLines={[[expectedOutput]]} type="result" />
                  </div>
              </TabsContent>

              <TabsContent value="diff" className="flex-grow overflow-hidden mt-0">
                <ScrollArea className="h-full">
                  <div className="p-3 grid grid-cols-2 gap-4">
                    <div className="border rounded h-[560px] overflow-auto">
                      <div className="p-2 text-xs text-muted-foreground">Your Output</div>
                      <div className="p-2">
                        {diffLines(expectedOutput, userOutputText).map((part, i) => {
                          const cls = part.added ? 'bg-green-50 dark:bg-green-900/30' : part.removed ? 'bg-red-50 dark:bg-red-900/30' : '';
                          return (
                            <pre key={i} className={cn('whitespace-pre-wrap break-words font-code p-1', cls)}>
                              {part.value}
                            </pre>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border rounded h-[560px] overflow-auto">
                      <div className="p-2 text-xs text-muted-foreground">Unified Diff</div>
                      <div className="p-2">
                        <pre className="whitespace-pre-wrap break-words font-code text-sm">
                          {diffLines(expectedOutput, userOutputText)
                            .map(p => {
                              if (p.added) return p.value.split('\n').map(l => `+ ${l}`).join('\n');
                              if (p.removed) return p.value.split('\n').map(l => `- ${l}`).join('\n');
                              return p.value.split('\n').map(l => `  ${l}`).join('\n');
                            })
                            .join('\n')}
                        </pre>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : (
              <div className="h-full">
                {errorLine && (
                  <div className="m-4 text-sm font-semibold text-destructive/80">Error on line {errorLine}</div>
                )}
                <OutputBlock outputLines={output.output} type={outputType} />
              </div>
          )}

          {/* issues area */}
          {(issues.length > 0 || output.aiAnalysis) && (
            <div className="border-t px-3 py-2 text-xs">
              <div className="font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Analysis
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                  {issues.length > 0 && (
                    <ul className="list-disc pl-5 mt-1">
                        {issues.map((it, i) => (
                        <li key={i}>{it}</li>
                        ))}
                    </ul>
                  )}
                  {output.aiAnalysis && (
                      <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: output.aiAnalysis.replace(/\n/g, '<br />') }} />
                  )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const OutputDisplay = React.memo(MemoizedOutputDisplay);
