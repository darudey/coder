

'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Compiler, type CompilerRef, type RunResult } from '@/components/codeweave/compiler';
import { GridEditor } from '@/components/codeweave/grid-editor';
import { FloatingDebugger } from '@/components/codeweave/floating-debugger';
import { generateTimeline } from '@/engine/interpreter';
import { useCompilerFs } from '@/hooks/use-compiler-fs';
import { OutputDisplay } from '@/components/codeweave/output-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Grab, X, GripHorizontal, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DotLoader } from '@/components/codeweave/dot-loader';
import { useSettings } from '@/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePresence } from '@/hooks/use-presence';
import { getDoc, doc } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import { LoadingPage } from '@/components/loading-page';
import { notFound } from 'next/navigation';
import { useRealtimeCode } from '@/hooks/use-realtime-code';

const MemoizedGridEditor = React.memo((props: any) => <GridEditor {...props} />);
MemoizedGridEditor.displayName = 'MemoizedGridEditor';


export default function SessionPage({ connectId }: { connectId?: string }) {
  const { settings } = useSettings();
  const [showDebugger, setShowDebugger] = useState(false);
  const isMobile = useIsMobile();
  const compilerRef = useRef<CompilerRef>(null);

  const [initialData, setInitialData] = useState<{ code: string, fileName: string } | null>(null);
  const [loading, setLoading] = useState(!!connectId);
  const [error, setError] = useState(false);

  // This is the key: useCompilerFs manages the local state (history, localstorage)
  const localFs = useCompilerFs({ initialCode: connectId ? initialData?.code : undefined });

  // useRealtimeCode manages the connection to Firebase for collaboration
  const { code: realtimeCode, setCode: setRealtimeCode } = useRealtimeCode(connectId, initialData?.code);

  const isRealtime = !!connectId;

  // This effect is the bridge: it syncs the realtime code back into the local filesystem hook.
  // This ensures that all save operations (auto and manual) work correctly.
  useEffect(() => {
    if (isRealtime && realtimeCode !== localFs.code) {
      localFs.setCode(realtimeCode);
    }
  }, [isRealtime, realtimeCode, localFs.code, localFs.setCode]);


  // When in a realtime session, ensure a local file exists for it.
  useEffect(() => {
    if (isRealtime && connectId && localFs.isFsReady && initialData) {
      const sessionFileName = `collab+${initialData.fileName}`;
      const sessionFolderName = 'Shared Sessions';
      
      if (!localFs.fileSystem[sessionFolderName]?.[sessionFileName]) {
        localFs.addFile(sessionFolderName, sessionFileName, initialData.code);
      }
      
      const isOpen = localFs.openFiles.some(f => f.fileName === sessionFileName && f.folderName === sessionFolderName);
      if (!isOpen) {
        localFs.loadFile(sessionFolderName, sessionFileName);
      }
    }
  }, [isRealtime, connectId, localFs.isFsReady, initialData, localFs]);

  useEffect(() => {
    if (!connectId) {
      setLoading(false);
      return;
    }

    const fetchCode = async () => {
      setLoading(true);
      const db = await getClientDb();
      if (!db) {
          setError(true);
          setLoading(false);
          return;
      }
      try {
          const docRef = doc(db, "shares", connectId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
              const data = docSnap.data();
              setInitialData({
                  code: data?.code || '',
                  fileName: data?.fileName || 'shared-code.js'
              });
          } else {
              setError(true);
          }
      } catch (e) {
          console.error(e);
          setError(true);
      } finally {
          setLoading(false);
      }
    };

    fetchCode();
  }, [connectId]);
  
  const { connectedUsers } = usePresence(connectId);
  
  const handleCodeChange = useCallback((newCode: string) => {
    // If in a realtime session, send changes to firebase.
    // Otherwise, the local file system hook will handle it.
    if (isRealtime) {
        setRealtimeCode(newCode);
    }
    localFs.setCode(newCode);

    setCurrentStep(1);
    setIsPlaying(false);
    setLineExecutionCounts({});
  }, [isRealtime, setRealtimeCode, localFs]);


  const [activeLine, setActiveLine] = useState(0);
  const [lineExecutionCounts, setLineExecutionCounts] = useState<Record<number, number>>({});
  const [output, setOutput] = useState<RunResult | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [panelWidth, setPanelWidth] = useState(30);

  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());

  const [position, setPosition] = React.useState({ top: 80, left: window.innerWidth / 2 + 100 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });
  const elementStartPos = React.useRef({ top: 0, left: 0 });
  
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
    const codeToGenerate = localFs.code ?? '';
    try {
      return generateTimeline(codeToGenerate);
    } catch (e: any) {
      console.error(e);
      return [{ step: 0, line: 0, variables: {}, heap: {}, stack: [], output: [`Error: ${e.message}`] }];
    }
  }, [localFs.code]);

  const currentState = timeline[currentStep];

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
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    const id = setInterval(() => {
      setCurrentStep((s) => {
        if (s + 1 >= timeline.length) {
          setIsPlaying(false);
          return s;
        }
        
        const nextState = timeline[s + 1];
        if (nextState && breakpoints.has(nextState.line)) {
            setIsPlaying(false);
            return s + 1;
        }

        return s + 1;
      });
    }, 900);

    return () => clearInterval(id);
  }, [isPlaying, timeline, breakpoints]);

  const play = () => setIsPlaying(true);
  const pause = () => setIsPlaying(false);

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

  const handleToggleBreakpoint = (lineNumber: number) => {
    setBreakpoints(prev => {
        const newSet = new Set(prev);
        if (newSet.has(lineNumber)) {
            newSet.delete(lineNumber);
        } else {
            newSet.add(lineNumber);
        }
        return newSet;
    });
  }

  const handleStartFromLine = useCallback((lineNumber: number) => {
    if (activeLine === lineNumber && showDebugger) {
        reset();
        setShowDebugger(false);
        return;
    }
    
    let targetStep = 1;
    for (let i = 1; i < timeline.length; i++) {
        if (timeline[i].line >= lineNumber) {
            targetStep = i;
            break;
        }
    }
    setCurrentStep(targetStep);
    setShowDebugger(true);
  }, [timeline, activeLine, showDebugger, reset]);

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

  if (loading) {
    return <LoadingPage />;
  }

  if (error) {
    notFound();
  }

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
    <div className="flex flex-col min-h-0">
        <Card className="flex flex-col flex-1 min-h-0">
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
            <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                <OutputDisplay output={output} isCompiling={isCompiling} />
            </CardContent>
        </Card>
    </div>
  );

  const showFloating = isMobile ? settings.outputMode === 'floating' : settings.outputMode === 'floating';
  const showSidePanel = !isMobile && settings.outputMode === 'side';
  
  const compilerProps = {
    ...localFs,
    onCodeChange: handleCodeChange,
    connectId: connectId,
  };


  return (
    <div className="bg-background h-[calc(100vh-4rem)]">
        {showSidePanel ? (
             <div className="grid h-full p-4 gap-4" style={{ gridTemplateColumns: `1fr ${panelWidth}%`}}>
                <div className="h-full flex flex-col overflow-y-auto">
                    <Compiler
                    ref={compilerRef}
                    {...compilerProps}
                    EditorComponent={MemoizedGridEditor}
                    onToggleDebugger={() => setShowDebugger(s => !s)}
                    activeLine={activeLine}
                    lineExecutionCounts={lineExecutionCounts}
                    hasActiveFile={!isRealtime ? !!localFs?.activeFile : true}
                    onRun={handleRun}
                    variant="default"
                    onResetDebugger={reset}
                    breakpoints={breakpoints}
                    onToggleBreakpoint={handleToggleBreakpoint}
                    onStartDebuggerFromLine={handleStartFromLine}
                    connectedUsers={connectedUsers}
                    />
                </div>
                <div className="h-full min-h-0 flex flex-col">{SidePanelOutput}</div>
            </div>
        ) : (
            <div className="h-full">
                <Compiler
                    ref={compilerRef}
                    {...compilerProps}
                    EditorComponent={MemoizedGridEditor}
                    onToggleDebugger={() => setShowDebugger(s => !s)}
                    activeLine={activeLine}
                    lineExecutionCounts={lineExecutionCounts}
                    hasActiveFile={!isRealtime ? !!localFs?.activeFile : true}
                    onRun={handleRun}
                    variant="default"
                    onResetDebugger={reset}
                    breakpoints={breakpoints}
                    onToggleBreakpoint={handleToggleBreakpoint}
                    onStartDebuggerFromLine={handleStartFromLine}
                    connectedUsers={connectedUsers}
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

declare module '@/components/codeweave/compiler' {
    interface CompilerProps {
        onResetDebugger?: () => void;
        breakpoints?: Set<number>;
        onToggleBreakpoint?: (lineNumber: number) => void;
        onStartDebuggerFromLine?: (lineNumber: number) => void;
    }
}

    