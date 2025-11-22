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

function indexToRowCol(code: string, index: number) {
  const lines = code.split('\n');
  let remaining = index;

  for (let row = 0; row < lines.length; row++) {
    const lineLength = lines[row].length + 1; // +1 for '\n'
    if (remaining < lineLength) {
      return { row, col: remaining };
    }
    remaining -= lineLength;
  }

  const lastRow = Math.max(0, lines.length - 1);
  return { row: lastRow, col: lines[lastRow]?.length ?? 0 };
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

  const [cursor, setCursor] = useState({ index: 0, row: 0, col: 0 });

  const fontSize = settings.editorFontSize ?? 14;

  const textStyle = useMemo<React.CSSProperties>(() => ({
    fontFamily: 'var(--font-code)',
    fontSize,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    tabSize: 2,
  }), [fontSize]);

  const lines = useMemo(() => code.split('\n'), [code]);

  const computeWrappedRows = useCallback(() => {
    const measure = measureRef.current;
    const gutter = gutterRef.current;
    const ta = textareaRef.current;
    if (!measure || !gutter || !ta) return;
    
    measure.style.width = `${ta.clientWidth}px`;
    gutter.innerHTML = '';

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i] === '' ? '\u00A0' : lines[i];
      measure.textContent = text;
      const height = measure.offsetHeight;
      const visualRows = Math.max(1, Math.round(height / (fontSize * 1.5)));
      
      const lineContainer = document.createElement('div');
      lineContainer.style.height = `${height}px`;
      lineContainer.className = 'flex';

      const numberEl = document.createElement('div');
      numberEl.className = cn(
        'w-full h-full px-2 flex items-start',
         i === cursor.row && 'text-foreground font-semibold'
      );
      numberEl.textContent = String(i + 1);
      
      lineContainer.appendChild(numberEl);
      gutter.appendChild(lineContainer);
    }
  }, [lines, fontSize, cursor.row]);
  
  const handleSelectionChange = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const index = ta.selectionStart ?? 0;
    const { row, col } = indexToRowCol(code, index);
    setCursor({ index, row, col });
  }, [code]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    
    const observer = new ResizeObserver(() => {
        computeWrappedRows();
    });
    observer.observe(ta);

    const handler = () => handleSelectionChange();
    ta.addEventListener('keyup', handler);
    ta.addEventListener('click', handler);
    ta.addEventListener('keydown', handler);

    return () => {
        observer.disconnect();
        ta.removeEventListener('keyup', handler);
        ta.removeEventListener('click', handler);
        ta.removeEventListener('keydown', handler);
    };
  }, [handleSelectionChange, computeWrappedRows]);

  useEffect(() => {
    computeWrappedRows();
    handleSelectionChange();
  }, [code, computeWrappedRows, handleSelectionChange]);

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (overlayRef.current) overlayRef.current.scrollTop = ta.scrollTop;
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  }, []);


  return (
    <div
      className="relative flex border rounded-md bg-background"
      style={{ height: 'calc(100vh - 80px)' }}
    >
      {/* Gutter with dynamic wrapped rows */}
      <div
        ref={gutterRef}
        className="w-12 shrink-0 border-r bg-muted text-xs text-muted-foreground overflow-hidden py-2"
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
          {lines.map((line, i) => (
             <div key={i}>{line === '' ? '\u00A0' : line}</div>
          ))}
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
          className="absolute invisible pointer-events-none"
          style={{ ...textStyle, padding: 0, border: 0 }}
        />
      </div>
    </div>
  );
};
