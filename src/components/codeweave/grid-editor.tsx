
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
  activeLine?: number;
}

export const GridEditor: React.FC<OverlayEditorProps> = ({
  code,
  onCodeChange,
  activeLine = 0,
}) => {
  const { settings } = useSettings();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [cursorLine, setCursorLine] = useState(0);

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

    // Sync measure div width with textarea width
    measure.style.width = `${ta.clientWidth}px`;
    gutter.innerHTML = '';

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i] === '' ? '\u00A0' : lines[i];
      measure.textContent = text;
      const height = measure.offsetHeight;

      const div = document.createElement('div');
      div.className = cn(
        'px-2 flex items-start text-xs text-muted-foreground h-full',
        i === cursorLine && 'text-foreground font-semibold'
      );
      div.style.height = `${height}px`;
      div.textContent = String(i + 1);
      gutter.appendChild(div);
    }
  }, [lines, fontSize, cursorLine]);

  const handleSelectionChange = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const index = ta.selectionStart ?? 0;
    
    let line = 0;
    for (let i = 0; i < index; i++) {
        if (code[i] === '\n') {
            line++;
        }
    }
    setCursorLine(line);

  }, [code]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    
    const observer = new ResizeObserver(() => {
        computeWrappedRows();
    });
    observer.observe(ta);

    const handler = () => handleSelectionChange();
    document.addEventListener('selectionchange', handler);
    ta.addEventListener('keyup', handler);
    ta.addEventListener('click', handler);

    return () => {
        observer.disconnect();
        document.removeEventListener('selectionchange', handler);
        ta.removeEventListener('keyup', handler);
        ta.removeEventListener('click', handler);
    };
  }, [handleSelectionChange, computeWrappedRows]);

  useEffect(() => {
    computeWrappedRows();
    handleSelectionChange();
  }, [code, computeWrappedRows, handleSelectionChange]);

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const scrollTop = ta.scrollTop;
    if (overlayRef.current) overlayRef.current.style.transform = `translateY(-${scrollTop}px)`;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(-${scrollTop}px)`;
  }, []);

  return (
    <div
      className="relative flex border rounded-md bg-background min-h-[70vh] overflow-hidden"
    >
      {/* Gutter with dynamic wrapped rows */}
      <div
        ref={gutterRef}
        className="w-12 shrink-0 border-r bg-muted py-2"
        style={{
          fontFamily: 'var(--font-code)',
          fontSize,
          lineHeight: 1.5,
        }}
      />

      {/* Editor area */}
      <div className="relative flex-1 h-full overflow-hidden">
        {/* Overlay text mirror */}
        <div
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none px-3 py-2"
          style={textStyle}
        >
            {lines.map((line, i) => (
                <div key={i} className={cn(
                    i === activeLine && "bg-blue-500/20",
                    i === cursorLine && "bg-muted/50"
                  )}>
                    {line === '' ? '\u00A0' : line}
                </div>
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
