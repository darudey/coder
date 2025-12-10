'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Compiler, type CompilerRef, type RunResult } from '@/components/codeweave/compiler';
import { GridEditor } from '@/components/codeweave/grid-editor';
import { FloatingDebugger } from '@/components/codeweave/floating-debugger';
import { generateTimeline } from '@/engine/interpreter';
import { useCompilerFs } from '@/hooks/use-compiler-fs';
import { OutputDisplay } from '@/components/codeweave/output-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Grab, X, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DotLoader } from '@/components/codeweave/dot-loader';
import { useSettings } from '@/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';

const factorialCode = `function factorial(n) {
  if (n === 0) {
    return 1;
  }
  return n * factorial(n - 1);
}

console.log(factorial(5));`;

export default function SessionPage() {
  const { settings } = useSettings();
  const [showDebugger, setShowDebugger] = useState(false);
  const isMobile = useIsMobile();
  const fs = useCompilerFs({ initialCode: factorialCode });
  const compilerRef = useRef<CompilerRef>(null);

  const [activeLine, setActiveLine] = useState(0);
  const [lineExecutionCounts, setLineExecutionCounts] = useState<Record<number, number>>({});
  const [output, setOutput] = useState<RunResult | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [panelWidth, setPanelWidth] = useState(30);

  // State for draggable panel
  const [position, setPosition] = React.useState({ top: 80, left: window.innerWidth / 2 + 100 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });
  const elementStartPos = React.useRef({ top: 0, left: 0 });
  
  // State for resizable panel
  const [resizeMode, setResizeMode] = React.useState<'height' | 'width-left' | 'width-right' | null>(null);
  const [panelSize, setPanelSize] = React.useState({ width: Math.max(350, window.innerWidth / 6), height: 400 });
  const resizeStartPos = React.useRef({ x: 0, y: 0, width: 0, height: 0, left: 0 });


  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    elementStartPos.current = { top: position.top, left: position.left };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    const touch = e.touches[0];
    dragStartPos.current = { x: touch.clientX, y: touch.clientY };
    elementStartPos.current = { top: position.top, left: position.left };
};

  const handleMouseMove = React.useCallback((e: MouseEvent | TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (resizeMode) {
      if (resizeMode === 'height') {
        const deltaY = clientY - resizeStartPos.current.y;
        const newHeight = resizeStartPos.current.height + deltaY;
        setPanelSize(s => ({ ...s, height: Math.max(150, Math.min(newHeight, window.innerHeight - 50)) }));
      } else if (resizeMode === 'width-left') {
          const deltaX = clientX - resizeStartPos.current.x;
          const newWidth = resizeStartPos.current.width - deltaX;
          if (newWidth > 300) {
            setPanelSize(s => ({...s, width: newWidth}));
            setPosition(p => ({...p, left: resizeStartPos.current.left + deltaX}));
          }
      } else if (resizeMode === 'width-right') {
          const deltaX = clientX - resizeStartPos.current.x;
          const newWidth = resizeStartPos.current.width + deltaX;
          setPanelSize(s => ({...s, width: Math.max(300, newWidth)}));
      }
    } else if (isDragging) {
        const deltaX = clientX - dragStartPos.current.x;
        const deltaY = clientY - dragStartPos.current.y;
        setPosition({
          top: elementStartPos.current.top + deltaY,
          left: elementStartPos.current.left + deltaX,
        });
    }
  }, [isDragging, resizeMode]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
    setResizeMode(null);
  }, []);

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>, mode: 'height' | 'width-left' | 'width-right') => {
    e.preventDefault();
    e.stopPropagation();
    setResizeMode(mode);
    resizeStartPos.current = { 
      x: e.clientX, 
      y: e.clientY, 
      width: panelSize.width, 
      height: panelSize.height,
      left: position.left
    };
  };

  const handleResizeTouchStart = (e: React.TouchEvent<HTMLDivElement>, mode: 'height' | 'width-left' | 'width-right') => {
    e.preventDefault();
    e.stopPropagation();
    setResizeMode(mode);
    const touch = e.touches[0];
    resizeStartPos.current = { 
      x: touch.clientX, 
      y: touch.clientY, 
      width: panelSize.width, 
      height: panelSize.height,
      left: position.left
    };
  };

  React.useEffect(() => {
    if (isDragging || resizeMode) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('touchend', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, resizeMode, handleMouseMove, handleMouseUp]);


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
      setShowOutput(true);
      setIsCompiling(true);
      setOutput(null);
      const result = await compilerRef.current.run();
      setOutput(result);
      setIsCompiling(false);
    }
  }, []);

  const DraggableOutputPanel = (
    <Card 
        className="fixed flex flex-col shadow-2xl z-40"
        style={{ 
          top: position.top, 
          left: position.left, 
          cursor: isDragging ? 'grabbing' : 'default', 
          width: `${panelSize.width}px`,
          height: `${panelSize.height}px` 
        }}
    >
      <div
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
        onMouseDown={(e) => handleResizeMouseDown(e, 'width-left')}
        onTouchStart={(e) => handleResizeTouchStart(e, 'width-left')}
      />
      <CardHeader 
        className="flex flex-row items-center justify-between p-2 border-b cursor-grab"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="flex items-center gap-2">
            <Grab className="w-4 h-4 text-muted-foreground" />
            <Button onClick={handleRun} disabled={isCompiling} size="sm" className="h-7">
              {isCompiling ? <DotLoader /> : <><Play className="w-3 h-3 mr-1" /> Run</>}
            </Button>
        </div>
        <span className="font-semibold text-sm">Output</span>
        <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowOutput(false)}>
                <X className="w-4 h-4" />
            </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-hidden">
        <OutputDisplay output={output} isCompiling={isCompiling} />
      </CardContent>
      <div 
        className="w-full h-2 cursor-ns-resize flex items-center justify-center bg-muted/50"
        onMouseDown={(e) => handleResizeMouseDown(e, 'height')}
        onTouchStart={(e) => handleResizeTouchStart(e, 'height')}
      >
        <GripHorizontal className="w-4 h-4 text-muted-foreground/50" />
      </div>
       <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
        onMouseDown={(e) => handleResizeMouseDown(e, 'width-right')}
        onTouchStart={(e) => handleResizeTouchStart(e, 'width-right')}
      />
    </Card>
  );

  const SidePanelOutput = (
    <div className="h-full flex flex-col overflow-hidden">
        <Card className="flex-grow flex flex-col">
            <CardHeader className="flex flex-row items-center p-2 border-b">
                <div className="flex items-center gap-1 flex-1">
                    <Button variant="ghost" size="xs" className="h-6 px-1 text-xs" onClick={() => setPanelWidth(20)}>20%</Button>
                    <Button variant="ghost" size="xs" className="h-6 px-1 text-xs" onClick={() => setPanelWidth(30)}>30%</Button>
                    <Button variant="ghost" size="xs" className="h-6 px-1 text-xs" onClick={() => setPanelWidth(40)}>40%</Button>
                </div>
                <CardTitle className="text-sm font-semibold flex-1 text-center">Output</CardTitle>
                <div className="flex-1 flex justify-end">
                    <Button onClick={handleRun} disabled={isCompiling} size="sm" className="h-7">
                        {isCompiling ? <DotLoader /> : <><Play className="w-3 h-3 mr-1" /> Run</>}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-grow overflow-auto">
                <OutputDisplay output={output} isCompiling={isCompiling} />
            </CardContent>
        </Card>
    </div>
  );

  const showFloating = isMobile ? settings.outputMode === 'floating' : settings.outputMode === 'floating';
  const showSidePanel = !isMobile && settings.outputMode === 'side';

  return (
    <div className="bg-background h-[calc(100vh-4rem)]">
        {showSidePanel ? (
             <div className="grid h-full p-4 gap-4" style={{ gridTemplateColumns: `1fr ${panelWidth}%`}}>
                <div className="h-full flex flex-col overflow-y-auto">
                    <Compiler
                    ref={compilerRef}
                    {...fs}
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
                {SidePanelOutput}
            </div>
        ) : (
            <div className="p-4 h-full">
                <Compiler
                    ref={compilerRef}
                    {...fs}
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
        )}

      {showFloating && showOutput && DraggableOutputPanel}

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
