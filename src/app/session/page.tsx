

'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Compiler } from '@/components/codeweave/compiler';
import { GridEditor } from '@/components/codeweave/grid-editor';
import { FloatingDebugger } from '@/components/codeweave/floating-debugger';
import { generateTimeline } from '@/engine/interpreter';


export default function SessionPage() {
  const [showDebugger, setShowDebugger] = useState(false);
  const [code, setCode] = useState(`function factorial(n) {
  if (n === 0) {
    return 1;
  }
  return n * factorial(n - 1);
}

const result = factorial(3);
console.log(result);`);
  const [activeLine, setActiveLine] = useState(0);

  const [currentStep, setCurrentStep] = useState(0);
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
  const nextState = timeline[currentStep + 1] ?? null;

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
    setCurrentStep(0);
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

  // Sync active line based on current interpreter step
  useEffect(() => {
    if (currentState) {
      setActiveLine(currentState.line);
    }
  }, [currentState]);
  
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    setCurrentStep(0);
    setIsPlaying(false);
  };

  return (
    <div className="bg-background min-h-screen">
      <Compiler 
        initialCode={code}
        onCodeChange={handleCodeChange}
        EditorComponent={GridEditor} 
        onToggleDebugger={() => setShowDebugger(s => !s)}
        activeLine={activeLine}
      />
      {showDebugger && (
        <FloatingDebugger
          state={currentState}
          nextState={nextState}
          nextStep={nextStep}
          prevStep={prevStep}
          play={play}
          pause={pause}
          reset={reset}
          isPlaying={isPlaying}
        />
      )}
    </div>
  );
}
