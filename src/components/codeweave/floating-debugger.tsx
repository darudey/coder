

"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Grab, X, GripHorizontal, Play, SkipBack, SkipForward, Pause, RefreshCw, Activity, Bot } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import type { TimelineEntry } from "@/engine/timeline";


const DraggablePanel: React.FC<{
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    initialPosition: { top: number, left: number };
    initialSize: { width: number, height: number };
}> = ({ title, children, onClose, initialPosition, initialSize }) => {
    const [position, setPosition] = useState(initialPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const elementStartPos = useRef({ top: 0, left: 0 });
    
    const [resizeMode, setResizeMode] = useState<'height' | 'width-left' | 'width-right' | null>(null);
    const [panelSize, setPanelSize] = useState(initialSize);
    const resizeStartPos = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0 });

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

    const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
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
                if (newWidth > 250) {
                    setPanelSize(s => ({ ...s, width: newWidth }));
                    setPosition(p => ({ ...p, left: resizeStartPos.current.left + deltaX }));
                }
            } else if (resizeMode === 'width-right') {
                const deltaX = clientX - resizeStartPos.current.x;
                const newWidth = resizeStartPos.current.width + deltaX;
                setPanelSize(s => ({ ...s, width: Math.max(250, newWidth) }));
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

    const handleMouseUp = useCallback(() => {
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

    useEffect(() => {
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


    return (
        <Card 
            className="fixed flex flex-col shadow-2xl z-50"
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
                </div>
                <span className="font-semibold text-sm">{title}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                    <X className="w-4 h-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-0 flex-grow overflow-hidden">
                <ScrollArea className="h-full">
                    {children}
                </ScrollArea>
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
};


const NextStepPanel: React.FC<{ message?: string }> = ({ message }) => {
    if (!message) return null;
    
    return (
        <div className="p-3">
            <div className="text-xs text-muted-foreground mt-1">
                {message}
            </div>
        </div>
    );
};


const ExpressionPanel: React.FC<{ evals?: Record<string, any> }> = ({ evals }) => {
    if (!evals || Object.keys(evals).length === 0) return null;
  
    return (
        <div className="p-2 bg-muted/50 rounded-md space-y-3">
          <div className="text-xs font-semibold text-muted-foreground px-2">
            Expression Evaluation
          </div>
    
          {Object.entries(evals).map(([expr, info]) => (
            <div key={expr} className="p-2 border rounded bg-background shadow-sm text-xs">
              {info.context && (
                  <div className="text-xs text-blue-500 font-semibold mb-1">
                    {info.context}
                  </div>
              )}
              <div className="font-mono font-semibold">
                {expr}
              </div>
    
              <div className="text-muted-foreground mt-1">
                Result: <span className="font-semibold text-foreground">{String(info.result)}</span>
              </div>
    
              <div className="mt-2 text-xs font-semibold">
                Breakdown:
              </div>
    
              <ul className="text-mono mt-1 space-y-1 pl-2">
                {info.breakdown.map((line: string, idx: number) => (
                  <li key={idx}>• {line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
  };

const ScopePanel = ({ scopes }: { scopes?: Record<string, any> }) => {
    if (!scopes || Object.keys(scopes).length === 0) return null;
    return (
        <div className="bg-muted/50 p-2 rounded-md space-y-1">
          <div className="text-xs font-semibold text-muted-foreground px-2">Scope</div>
    
          {Object.entries(scopes).map(([scopeName, vars]) => (
            <details
              key={scopeName}
              open
              className="border border-border/50 rounded p-1"
            >
              <summary className="cursor-pointer text-xs font-medium list-none">
                <span className="pl-1">{scopeName}</span>
              </summary>
    
              <div className="pl-3 text-xs space-y-1 mt-1">
                {Object.entries(vars as any).map(([key, value]) => (
                  <div key={key} className="flex justify-between font-mono text-muted-foreground">
                    <span className="truncate" title={key}>{key}:</span>
                    <span className="text-foreground">
                      {typeof value === "object" && value !== null
                        ? JSON.stringify(value)
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      );
}

const CallStackPanel = ({ stack }: { stack?: string[] }) => {
    if (!stack) return null;
    return (
      <div className="bg-muted/50 p-2 rounded-md space-y-1">
        <div className="text-xs font-semibold text-muted-foreground px-2">Call Stack</div>
        <div className="text-xs space-y-1 p-2">
            {stack.length > 0 ? stack.map((frame, index) => (
                <div key={index} className="font-mono text-foreground">{frame}</div>
            )) : (
                <div className="text-muted-foreground italic">(empty)</div>
            )}
        </div>
      </div>
    );
};

const FlowPanel: React.FC<{ flow?: string[] }> = ({ flow }) => {
    if (!flow || flow.length === 0) return null;
    return (
      <div className="p-3">
        {flow.map((message, index) => (
            <div key={index} className="font-mono text-xs text-muted-foreground">
                <span className="mr-1 text-purple-400">›</span>{message}
            </div>
        ))}
      </div>
    );
  };


export const FloatingDebugger = ({
  state,
  nextStep,
  prevStep,
  play,
  pause,
  reset,
  isPlaying,
  onClose,
}: {
  state: TimelineEntry;
  nextStep: () => void;
  prevStep: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  isPlaying: boolean;
  onClose: () => void;
}) => {
  const [showFlowPanel, setShowFlowPanel] = useState(false);
  const [showNextStepPanel, setShowNextStepPanel] = useState(false);

  if (!state) return null;

  return (
    <>
        <DraggablePanel
            title="Debugger"
            onClose={onClose}
            initialPosition={{ top: 80, left: window.innerWidth - 400 }}
            initialSize={{ width: 350, height: 500 }}
        >
            <div className="p-2 space-y-3">
                <div className="flex gap-1">
                    <Button size="icon" className="h-7 w-7" variant="outline" onClick={prevStep}><SkipBack className="w-4 h-4" /></Button>
                    <Button size="icon" className="h-7 w-7" variant="outline" onClick={nextStep}><SkipForward className="w-4 h-4" /></Button>
                        {!isPlaying ? (
                        <Button size="icon" className="h-7 w-7" variant="outline" onClick={play}>
                            <Play className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button size="icon" className="h-7 w-7" variant="outline" onClick={pause}>
                            <Pause className="w-4 h-4" />
                        </Button>
                    )}
                    <Button size="icon" className="h-7 w-7" variant="outline" onClick={reset}><RefreshCw className="w-4 h-4" /></Button>
                </div>

                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" className="w-full h-7 text-xs" onClick={() => setShowFlowPanel(s => !s)}>
                        <Activity className="w-3 h-3 mr-2"/>
                        Control Flow
                    </Button>
                     <Button size="sm" variant="secondary" className="w-full h-7 text-xs" onClick={() => setShowNextStepPanel(s => !s)}>
                        <Bot className="w-3 h-3 mr-2"/>
                        Next Step AI
                    </Button>
                </div>


                <div className="text-xs font-mono"><b>Step:</b> {state.step} | <b>Line:</b> {state.line + 1}</div>
                
                <ExpressionPanel evals={state.expressionEval} />
                <ScopePanel scopes={state.variables} />
                <CallStackPanel stack={state.stack} />

                <details className="pt-4">
                    <summary className="text-xs cursor-pointer text-muted-foreground">Raw State</summary>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                    {JSON.stringify(state, null, 2)}
                    </pre>
                </details>
            </div>
        </DraggablePanel>

        {showFlowPanel && (
            <DraggablePanel
                title="Control Flow"
                onClose={() => setShowFlowPanel(false)}
                initialPosition={{ top: 100, left: window.innerWidth - 800 }}
                initialSize={{ width: 350, height: 250 }}
            >
                <FlowPanel flow={state.controlFlow} />
            </DraggablePanel>
        )}

        {showNextStepPanel && (
            <DraggablePanel
                title="Next Step"
                onClose={() => setShowNextStepPanel(false)}
                initialPosition={{ top: 400, left: window.innerWidth - 800 }}
                initialSize={{ width: 350, height: 200 }}
            >
                <NextStepPanel message={state.nextStep} />
            </DraggablePanel>
        )}
    </>
  );
};

    