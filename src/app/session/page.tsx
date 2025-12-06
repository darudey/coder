

'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Compiler, type CompilerRef, type RunResult } from '@/components/codeweave/compiler';
import { GridEditor } from '@/components/codeweave/grid-editor';
import { FloatingDebugger } from '@/components/codeweave/floating-debugger';
import { generateTimeline } from '@/engine/interpreter';
import { useCompilerFs } from '@/hooks/use-compiler-fs';
import { OutputDisplay } from '@/components/codeweave/output-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DotLoader } from '@/components/codeweave/dot-loader';

export default function SessionPage() {
  const [showDebugger, setShowDebugger] = useState(false);
  const fs = useCompilerFs({
    initialCode: `function factorial(n) {
  if (n === 0) {
    return 1;
  }
  return n * factorial(n - 1);
}

const result = factorial(3);
console.log(result);`
  });
  const compilerRef = useRef<CompilerRef>(null);

  const [activeLine, setActiveLine] = useState(0);
  const [lineExecutionCounts, setLineExecutionCounts] = useState<Record<number, number>>({});
  const [output, setOutput] = useState<RunResult | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const timeline = useMemo(() => {
    try {
      return generateTimeline(fs.code);
    } catch (e: any) {
      console.error(e);
      // Return a minimal timeline to prevent crashing
      return [{ step: 0, line: 0, variables: {}, heap: {}, stack: [], output: [`Error: ${e.message}`] }];
    }
  }, [fs.code]);

  const currentState = timeline[currentStep];

  // STEP CONTROL
  const nextStep = useCallback(() => {
    setCurrentStep((s) =>
      s + 1 < timeline.length ? s + 1 : s
    );
  }, [timeline]);

  const prevStep = useCallback(() => {
    setCurrentStep((s) => (s > 0 ? s - 1 : 0));
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(1);
    setLineExecutionCounts({});
  }, []);

  // PLAY LOGIC
  useEffect(() => {
    if (!isPlaying) return;

    const id = setInterval(() => {
      setCurrentStep((s) => {
        if (s + 1 >= timeline.length) {
          setIsPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 900);

    return () => clearInterval(id);
  }, [isPlaying, timeline.length]);

  const play = () => setIsPlaying(true);
  const pause = () => setIsPlaying(false);

  // Sync active line and execution counts based on current interpreter step
  useEffect(() => {
    if (currentState) {
      const currentLine = currentState.line;
      setActiveLine(currentLine);
      setLineExecutionCounts(prevCounts => {
        const newCounts = { ...prevCounts };
        newCounts[currentLine] = (newCounts[currentLine] || 0) + 1;
        return newCounts;
      });
    }
  }, [currentState]);
  
  const handleCodeChange = (newCode: string) => {
    fs.setCode(newCode);
    setCurrentStep(1);
    setIsPlaying(false);
    setLineExecutionCounts({});
  };

  const handleRun = useCallback(async () => {
    if (compilerRef.current) {
      setIsCompiling(true);
      setOutput(null);
      const result = await compilerRef.current.run();
      setOutput(result);
      setIsCompiling(false);
    }
  }, []);

  return (
    <div className="bg-background h-[calc(100vh-4rem)]">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 h-full">
        <div className="h-full flex flex-col">
            <Compiler
              ref={compilerRef}
              {...fs}
              code={fs.code}
              onCodeChange={handleCodeChange}
              EditorComponent={GridEditor} 
              onToggleDebugger={() => setShowDebugger(s => !s)}
              activeLine={activeLine}
              lineExecutionCounts={lineExecutionCounts}
              hasActiveFile={!!fs.activeFile}
              onRun={handleRun}
              variant="default"
            />
        </div>
        <div className="h-full flex flex-col">
            <Card className="flex-grow flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between p-2 border-b">
                    <CardTitle className="text-sm font-semibold">Output</CardTitle>
                    <Button onClick={handleRun} disabled={isCompiling} size="sm" className="h-7">
                        {isCompiling ? <DotLoader /> : <><Play className="w-3 h-3 mr-1" /> Run</>}
                    </Button>
                </CardHeader>
                <CardContent className="p-0 flex-grow overflow-hidden">
                    <OutputDisplay output={output} isCompiling={isCompiling} />
                </CardContent>
            </Card>
        </div>
      </div>
      {showDebugger && (
        <FloatingDebugger
          state={currentState}
          nextStep={nextStep}
          prevStep={prevStep}
          play={play}
          pause={pause}
          reset={reset}
          isPlaying={isPlaying}
          onClose={() => setShowDebugger(false)}
        />
      )}
    </div>
  );
}

// Add new prop to Compiler's EditorComponent
declare module '@/components/codeweave/grid-editor' {
    interface OverlayEditorProps {
        lineExecutionCounts?: Record<number, number>;
    }
}
