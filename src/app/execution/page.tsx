
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { GridEditor } from "@/components/codeweave/grid-editor";
import { FloatingDebugger } from "@/components/codeweave/floating-debugger";

// Example timeline (replace with your interpreter output)
const exampleTimeline = [
  {
    step: 0,
    line: 0,
    variables: { a: 1, b: 2 },
    heap: { arr: [1, 2] },
    stack: ["main"],
    output: []
  },
  {
    step: 1,
    line: 1,
    variables: { a: 1, b: 3 },
    heap: { arr: [1, 2, 3] },
    stack: ["main"],
    output: []
  },
  {
    step: 2,
    line: 2,
    variables: { a: 5, b: 3 },
    heap: { arr: [1, 2, 3, 5] },
    stack: ["main"],
    output: ["print: 5"]
  },
  {
    step: 3,
    line: 3,
    variables: { a: 5, b: 3 },
    heap: { arr: [1, 2, 3, 5] },
    stack: ["main"],
    output: ["print: 5", "3"]
  }
];

export default function ExecutionPage() {
  const [code, setCode] = useState(`let a = 1;
let b = 2;
b = b + 1;
console.log(b);`);

  const [activeLine, setActiveLine] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const timeline = exampleTimeline;
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

  return (
    <div className="relative min-h-screen p-4">
      {/* Grid Editor */}
      <GridEditor
        code={code}
        onCodeChange={setCode}
        activeLine={activeLine}
      />

      {/* Floating Debugger */}
      <FloatingDebugger
        state={currentState}
        nextStep={nextStep}
        prevStep={prevStep}
        play={play}
        pause={pause}
        reset={reset}
        isPlaying={isPlaying}
      />
    </div>
  );
}
