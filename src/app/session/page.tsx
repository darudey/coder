

'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Compiler } from '@/components/codeweave/compiler';
import { GridEditor } from '@/components/codeweave/grid-editor';
import { FloatingDebugger } from '@/components/codeweave/floating-debugger';
import { generateTimeline } from '@/engine/interpreter';
import { useCompilerFs } from '@/hooks/use-compiler-fs';


export default function SessionPage() {
  const [showDebugger, setShowDebugger] = useState(false);
  const { code, setCode, activeFile, ...fsProps } = useCompilerFs({
    initialCode: `function factorial(n) {
  if (n === 0) {
    return 1;
  }
  return n * factorial(n - 1);
}

const result = factorial(3);
console.log(result);`
  });

  const [activeLine, setActiveLine] = useState(0);
  const [lineExecutionCounts, setLineExecutionCounts] = useState<Record<number, number>>({});

  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  const timeline = useMemo(() => {
    try {
      return generateTimeline(code);
    } catch (e: any) {
      console.error(e);
      // Return a minimal timeline to prevent crashing
      return [{ step: 0, line: 0, variables: {}, heap: {}, stack: [], output: [`Error: ${e.message}`] }];
    }
  }, [code]);

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
    setCode(newCode);
    setCurrentStep(1);
    setIsPlaying(false);
    setLineExecutionCounts({});
  };

  return (
    <div className="bg-background min-h-screen">
      <Compiler 
        {...fsProps}
        code={code}
        onCodeChange={handleCodeChange}
        EditorComponent={GridEditor} 
        onToggleDebugger={() => setShowDebugger(s => !s)}
        activeLine={activeLine}
        lineExecutionCounts={lineExecutionCounts}
        activeFile={activeFile}
        hasActiveFile={!!activeFile}
      />
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
