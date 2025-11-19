
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DotLoader } from './dot-loader';
import AnsiToHtml from '@/lib/ansi-to-html';
import { cn } from '@/lib/utils';
import { diffLines } from 'diff';
import { motion, AnimatePresence } from 'framer-motion';
import Prism from 'prismjs';
// Removed the direct import of prism-javascript here
import 'prismjs/themes/prism.css';
import { FixedSizeList as VirtualList } from 'react-window';
import { Copy, Check, X, Activity } from 'lucide-react';

// Types
import type { RunResult } from './compiler';

interface OutputDisplayProps {
  output: RunResult | null;
  isCompiling: boolean;
  isAiChecking?: boolean;
  expectedOutput?: string;
}

/* ------------------- Helpers ------------------- */
const getErrorLine = (text: string): string | null => {
  if (!text) return null;
  const match = text.match(/(?:<anonymous>|eval).*?:(\d+):(\d+)/);
  return match?.[1] ?? null;
};

const detectBeginnerIssues = (text: string) => {
  if (!text) return [];
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
        <div className="text-sm font-medium">Output</div>
        {typeof runTime === 'number' && (
          <div className="text-xs text-muted-foreground">Execution: {runTime}ms</div>
        )}
        {isError && <div className="text-xs text-destructive">Error</div>}
        {passed !== null && typeof passed !== 'undefined' && (
          <div className={cn('text-xs font-semibold', passed ? 'text-green-600' : 'text-red-600')}>
            {passed ? 'Matches expected' : 'Mismatch'}
          </div>
        )}
      </div>

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

/* ------------------- Output renderer ------------------- */

const LineRendered = ({ line, idx, isError }: { line: string; idx: number; isError?: boolean }) => (
  <div className="flex min-w-0">
    <div className="select-none pr-3 text-xs text-muted-foreground tabular-nums">{idx + 1}</div>
    <div className={cn('whitespace-pre-wrap font-code flex-1', isError ? 'text-destructive' : 'text-foreground')} style={{ wordBreak: 'break-word' }}>
      <span dangerouslySetInnerHTML={{ __html: line }} />
    </div>
  </div>
);
LineRendered.displayName = 'LineRendered';

const VirtualizedLines = ({ lines, isError }: { lines: string[]; isError?: boolean }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style} className="px-4 py-1">
      <LineRendered line={lines[index]} idx={index} isError={isError} />
    </div>
  );

  return (
    <VirtualList
      height={600}
      itemCount={lines.length}
      itemSize={22}
      width="100%"
      className="overflow-auto"
    >
      {Row}
    </VirtualList>
  );
};
VirtualizedLines.displayName = 'VirtualizedLines';

const OutputBlock: React.FC<{
  content: string;
  type: 'result' | 'error';
  autoScroll?: boolean;
  collapseThreshold?: number;
}> = ({ content, type, autoScroll = true, collapseThreshold = 800 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(() => content.length < collapseThreshold);

  useEffect(() => {
    setExpanded(content.length < collapseThreshold);
  }, [content, collapseThreshold]);

  useEffect(() => {
    if (!autoScroll) return;
    // Scroll to bottom when new content arrives
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [content, autoScroll]);

  // Convert ANSI -> HTML then syntax-highlight code blocks inside
  const html = useMemo(() => AnsiToHtml(content), [content]);

  // split into lines for advanced rendering
  const rawLines = useMemo(() => html.split('\n'), [html]);

  // determine if we should use virtualization
  const useVirtual = rawLines.length > 2000;

  return (
    <div className="h-full flex flex-col">
      <div ref={containerRef} className="flex-grow overflow-auto">
        <div className="px-2 py-3">
          <AnimatePresence initial={false} mode="wait">
            <motion.div key={expanded ? 'expanded' : 'collapsed'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              {expanded ? (
                useVirtual ? (
                  <VirtualizedLines lines={rawLines} isError={type === 'error'} />
                ) : (
                  <div className="space-y-1">
                    {rawLines.map((line, i) => (
                      <div key={i} className="px-2">
                        <LineRendered line={line || '\u00A0'} idx={i} isError={type === 'error'} />
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="prose max-h-[240px] overflow-hidden text-sm" style={{ wordWrap: 'break-word' }}>
                  <div dangerouslySetInnerHTML={{ __html: html.slice(0, collapseThreshold) }} />
                  {html.length > collapseThreshold && <span>... </span>}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {content.length > collapseThreshold && (
        <div className="px-3 py-2 border-t flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Output length: {content.length} chars</div>
          <button
            className="text-sm px-2 py-1 rounded hover:bg-muted"
            onClick={() => setExpanded(s => !s)}
          >
            {expanded ? 'Collapse' : 'Show more'}
          </button>
        </div>
      )}
    </div>
  );
};
OutputBlock.displayName = 'OutputBlock';

/* ------------------- Main Component ------------------- */

const MemoizedOutputDisplay: React.FC<OutputDisplayProps> = ({
  output,
  isCompiling,
  isAiChecking,
  expectedOutput,
}) => {
  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef<number | null>(null);

  useEffect(() => {
    // Dynamically import the prism-javascript component to ensure Prism is defined first.
    import('prismjs/components/prism-javascript');
  }, []);

  useEffect(() => () => {
    if (copyTimeout.current) window.clearTimeout(copyTimeout.current);
  }, []);

  const runTime = (output as any)?.durationMs ?? (output as any)?.timeMs ?? null;

  const issues = useMemo(() => detectBeginnerIssues((output as any)?.output ?? ''), [output]);

  const onCopy = useCallback(async () => {
    const text = (output as any)?.output ?? '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimeout.current) window.clearTimeout(copyTimeout.current);
      copyTimeout.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      if (copyTimeout.current) window.clearTimeout(copyTimeout.current);
      copyTimeout.current = window.setTimeout(() => setCopied(false), 2000);
    }
  }, [output]);

  // Loading
  if (isCompiling) return <LoadingState isAiChecking={isAiChecking} />;

  // Empty
  if (!output)
    return (
      <p className="text-muted-foreground p-4">Click "Run" to execute the code and see the output here.</p>
    );

  const userOutput = (output as any).output ?? '';
  const outputType = (output as any).type ?? 'result';

  const errorLine = getErrorLine(userOutput);

  // pass/fail detection for expected output
  const passed = typeof expectedOutput === 'string' ? expectedOutput.trim() === userOutput.trim() : null;

  /* ------------- Render with enhanced UI ------------- */
  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-none border-0">
      <HeaderBar onCopy={onCopy} copied={copied} runTime={runTime} issues={issues} isError={outputType === 'error'} passed={passed} />

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
                <ScrollArea className="h-full">
                  <div className="h-full">
                    {errorLine && (
                      <div className="m-4 text-sm font-semibold text-destructive/80">Error on line {errorLine}</div>
                    )}
                    <OutputBlock content={userOutput} type={outputType} />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="required" className="flex-grow overflow-hidden mt-0">
                <ScrollArea className="h-full">
                  <div className="h-full">
                    <OutputBlock content={expectedOutput} type="result" />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="diff" className="flex-grow overflow-hidden mt-0">
                <ScrollArea className="h-full">
                  <div className="p-3 grid grid-cols-2 gap-4">
                    <div className="border rounded h-[560px] overflow-auto">
                      <div className="p-2 text-xs text-muted-foreground">Your Output</div>
                      <div className="p-2">
                        {/* pretty print lines with diffs */}
                        {diffLines(expectedOutput, userOutput).map((part, i) => {
                          const cls = part.added ? 'bg-green-50' : part.removed ? 'bg-red-50' : '';
                          return (
                            <pre key={i} className={cn('whitespace-pre-wrap font-code p-1', cls)}>
                              {part.value}
                            </pre>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border rounded h-[560px] overflow-auto">
                      <div className="p-2 text-xs text-muted-foreground">Unified Diff</div>
                      <div className="p-2">
                        <pre className="whitespace-pre-wrap font-code text-sm">
                          {diffLines(expectedOutput, userOutput)
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
            <ScrollArea className="h-full">
              <div className="h-full">
                {errorLine && (
                  <div className="m-4 text-sm font-semibold text-destructive/80">Error on line {errorLine}</div>
                )}
                <OutputBlock content={userOutput} type={outputType} />
              </div>
            </ScrollArea>
          )}

          {/* issues area */}
          {issues.length > 0 && (
            <div className="border-t px-3 py-2 text-xs text-amber-800">
              <div className="font-semibold">Hints</div>
              <ul className="list-disc pl-5 mt-1">
                {issues.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const OutputDisplay = React.memo(MemoizedOutputDisplay);
