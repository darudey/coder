
"use client";

import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";

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
        <div className="mt-2 space-y-2 text-sm">
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

          <div><b>Step:</b> {state.step}</div>
          <div><b>Line:</b> {state.line}</div>

          <div>
            <b>Variables:</b>
            <pre className="text-xs bg-muted p-2 rounded">
              {JSON.stringify(state.variables, null, 2)}
            </pre>
          </div>

          <div>
            <b>Heap:</b>
            <pre className="text-xs bg-muted p-2 rounded">
              {JSON.stringify(state.heap, null, 2)}
            </pre>
          </div>

          <div>
            <b>Call Stack:</b>
            <pre className="text-xs bg-muted p-2 rounded">
              {JSON.stringify(state.stack, null, 2)}
            </pre>
          </div>

          <div>
            <b>Output:</b>
            <pre className="text-xs bg-muted p-2 rounded">
              {(state.output ?? []).join("\n")}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
