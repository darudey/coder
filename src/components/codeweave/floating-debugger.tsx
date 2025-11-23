
"use client";

import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";

const ScopePanel = ({ scopes }: { scopes: Record<string, any> }) => {
    if (!scopes) return null;
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
                {Object.entries(vars).map(([key, value]) => (
                  <div key={key} className="flex justify-between font-mono text-muted-foreground">
                    <span>{key}:</span>
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

const CallStackPanel = ({ stack }: { stack: string[] }) => {
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


export const FloatingDebugger = ({
  state,
  nextStep,
  prevStep,
  play,
  pause,
  reset,
  isPlaying
}: {
  state: any;
  nextStep: () => void;
  prevStep: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
  isPlaying: boolean;
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);

  // Dragging
  const drag = (e: React.MouseEvent) => {
    const el = windowRef.current;
    if (!el) return;

    const shiftX = e.clientX - el.getBoundingClientRect().left;
    const shiftY = e.clientY - el.getBoundingClientRect().top;

    const moveAt = (pageX: number, pageY: number) => {
      el.style.left = pageX - shiftX + "px";
      el.style.top = pageY - shiftY + "px";
    };

    const onMouseMove = (event: MouseEvent) => {
      moveAt(event.pageX, event.pageY);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener(
      "mouseup",
      () => {
        document.removeEventListener("mousemove", onMouseMove);
      },
      { once: true }
    );
  };

  if (!state) return null;

  return (
    <div
      ref={windowRef}
      className={cn(
        "fixed bottom-12 right-4 z-[9999]",
        "backdrop-blur-md bg-background/70 border",
        "rounded-xl shadow-xl p-3 w-80",
        "resize overflow-auto"
      )}
      style={{ cursor: "default" }}
    >
      {/* Drag handle */}
      <div
        className="w-full h-6 bg-muted/40 rounded mb-2 cursor-move active:cursor-grabbing"
        onMouseDown={drag}
      />

      {/* Minimize */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="text-xs px-2 py-1 bg-muted rounded"
      >
        {collapsed ? "Expand" : "Hide"}
      </button>

      {!collapsed && (
        <div className="mt-2 space-y-4 text-sm">
          {/* Controls */}
          <div className="flex gap-2 text-xs mb-2">
            <button className="px-2 py-1 bg-primary/20 rounded" onClick={prevStep}>
              Prev
            </button>

            <button className="px-2 py-1 bg-primary/20 rounded" onClick={nextStep}>
              Next
            </button>

            {!isPlaying ? (
              <button className="px-2 py-1 bg-green-500/30 rounded" onClick={play}>
                Play
              </button>
            ) : (
              <button className="px-2 py-1 bg-yellow-500/30 rounded" onClick={pause}>
                Pause
              </button>
            )}

            <button className="px-2 py-1 bg-red-500/30 rounded" onClick={reset}>
              Reset
            </button>
          </div>

          <div className="text-xs"><b>Step:</b> {state.step} | <b>Line:</b> {state.line}</div>

          <ScopePanel scopes={state.variables} />
          <CallStackPanel stack={state.stack} />

          <details className="pt-4">
            <summary className="text-xs cursor-pointer text-muted-foreground">Raw State</summary>
            <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
              {JSON.stringify(state, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};
