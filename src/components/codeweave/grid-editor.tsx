
'use client';

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/hooks/use-settings';

interface OverlayEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
}

export const OverlayCodeEditor: React.FC<OverlayEditorProps> = ({
  code,
  onCodeChange,
}) => {
  const { settings } = useSettings();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  const fontSize = settings.editorFontSize ?? 14;

  // Shared text style (MUST MATCH EXACTLY)
  const textStyle = useMemo<React.CSSProperties>(() => ({
    fontFamily: 'var(--font-code)',
    fontSize,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'normal',
    tabSize: 2,
  }), [fontSize]);

  const lines = useMemo(() => code.split('\n'), [code]);

  /** -------------------------------------------------------------------
   *  #1 FIX: Measure wrapped height using mirror (no-drift + correct gutter)
   * ------------------------------------------------------------------*/
  const computeWrappedRows = useCallback(() => {
    const measure = measureRef.current;
    const gutter = gutterRef.current;
    if (!measure || !gutter) return;

    gutter.innerHTML = ''; // reset

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i] === '' ? '\u00A0' : lines[i];

      // Put text into measurement mirror
      measure.textContent = text;

      // Height of wrapped line in px
      const height = measure.offsetHeight;

      // Each visual row = lineHeight * fontSize * 1.5
      const visualRows = Math.max(1, Math.round(height / (fontSize * 1.5)));

      // Add equal rows to gutter
      for (let v = 0; v < visualRows; v++) {
        const div = document.createElement('div');
        div.className =
          'px-2 flex items-center text-xs text-gray-500 dark:text-gray-400';
        div.style.height = `${fontSize * 1.5}px`;

        if (v === 0) div.textContent = String(i + 1);
        else div.textContent = ''; // wrapped continuation

        gutter.appendChild(div);
      }
    }
  }, [lines, fontSize]);

  useEffect(() => {
    computeWrappedRows();
  }, [code, computeWrappedRows]);

  /** -------------------------------------------------------------------
   *  Scroll sync: textarea → overlay + gutter
   * ------------------------------------------------------------------*/
  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (overlayRef.current) overlayRef.current.scrollTop = ta.scrollTop;
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  }, []);

  /** -------------------------------------------------------------------
   *  Cursor highlight (optional)
   * ------------------------------------------------------------------*/
  const [cursorPos, setCursorPos] = useState(0);

  const handleSelection = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    setCursorPos(ta.selectionStart);
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.addEventListener('click', handleSelection);
    ta.addEventListener('keyup', handleSelection);
    ta.addEventListener('keydown', handleSelection);
    return () => {
      ta.removeEventListener('click', handleSelection);
      ta.removeEventListener('keyup', handleSelection);
      ta.removeEventListener('keydown', handleSelection);
    };
  }, []);

  return (
    <div
      className="relative flex border rounded-md bg-background"
      style={{ height: 'calc(100vh - 80px)' }}
    >
      {/* Gutter with dynamic wrapped rows */}
      <div
        ref={gutterRef}
        className="w-12 shrink-0 border-r bg-muted overflow-hidden"
        style={{
          fontFamily: 'var(--font-code)',
          fontSize,
          lineHeight: 1.5,
        }}
      />

      {/* Editor area */}
      <div className="relative flex-1 h-full">
        {/* Overlay text mirror */}
        <div
          ref={overlayRef}
          className="absolute inset-0 overflow-auto pointer-events-none px-3 py-2"
          style={textStyle}
        >
          {lines.join('\n')}
        </div>

        {/* REAL textarea */}
        <Textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          onScroll={syncScroll}
          className={cn(
            'absolute inset-0 w-full h-full resize-none border-0 bg-transparent',
            'focus-visible:ring-0 focus-visible:ring-offset-0 text-transparent caret-foreground',
            'px-3 py-2 font-code'
          )}
          style={textStyle}
          spellCheck={false}
        />

        {/* Hidden measuring mirror */}
        <div
          ref={measureRef}
          className="absolute invisible pointer-events-none w-[calc(100%-3rem)] px-3 py-2"
          style={textStyle}
        />
      </div>
    </div>
  );
};
