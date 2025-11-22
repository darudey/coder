
'use client';

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/use-settings';
import { Textarea } from '@/components/ui/textarea';

interface OverlayEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
  onCursorChange?: (info: {
    index: number;
    row: number;
    col: number;
  }) => void;
}

function indexToRowCol(code: string, index: number) {
  const lines = code.split('\n');
  let remaining = index;

  for (let row = 0; row < lines.length; row++) {
    const lineLength = lines[row].length + 1; // +1 for '\n'
    if (remaining <= lineLength - 1) {
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
  onCursorChange,
}) => {
  const { settings } = useSettings();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const [cursor, setCursor] = useState({ index: 0, row: 0, col: 0 });

  const lines = code.split('\n');

  // Sync scroll of overlay & gutter with textarea
  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    const overlay = overlayRef.current;
    const gutter = gutterRef.current;
    if (!ta) return;
    if (overlay) overlay.scrollTop = ta.scrollTop;
    if (gutter) gutter.scrollTop = ta.scrollTop;
  }, []);

  // Update cursor info when textarea selection changes
  const handleSelectionChange = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const index = ta.selectionStart ?? 0;
    const { row, col } = indexToRowCol(code, index);
    setCursor({ index, row, col });
    onCursorChange?.({ index, row, col });
  }, [code, onCursorChange]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const handler = () => handleSelectionChange();
    ta.addEventListener('keyup', handler);
    ta.addEventListener('click', handler);
    ta.addEventListener('keydown', handler);

    return () => {
      ta.removeEventListener('keyup', handler);
      ta.removeEventListener('click', handler);
      ta.removeEventListener('keydown', handler);
    };
  }, [handleSelectionChange]);

  useEffect(() => {
    handleSelectionChange();
  }, [code, handleSelectionChange]);

  const fontSize = settings.editorFontSize ?? 14;

  // Example helper: highlight a single "square" (row,col)
  const highlightCell = useCallback((row: number, col: number) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const el = overlay.querySelector(
      `[data-row="${row}"][data-col="${col}"]`
    ) as HTMLElement | null;
    if (!el) return;
    el.classList.add('bg-yellow-200');
    setTimeout(() => el.classList.remove('bg-yellow-200'), 300);
  }, []);

  // You can call highlightCell(cursor.row, cursor.col) from outside via onCursorChange.

  return (
    <div
      className="relative flex border rounded-md bg-background"
      style={{ height: 'calc(100vh - 80px)' }}
    >
      {/* Gutter */}
      <div
        ref={gutterRef}
        className="w-10 shrink-0 border-r bg-muted text-xs text-muted-foreground overflow-hidden"
        style={{
          fontFamily: 'var(--font-code)',
          fontSize,
          lineHeight: 1.5,
        }}
      >
        <div className="relative">
          {lines.map((_, i) => (
            <div
              key={i}
              className={cn(
                'px-2 h-[1.5em] flex items-center',
                i === cursor.row && 'text-foreground font-semibold'
              )}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Editor area */}
      <div className="relative flex-1 h-full">
        {/* Overlay with per-character spans */}
        <div
          ref={overlayRef}
          className="absolute inset-0 overflow-auto pointer-events-none"
          style={{
            fontFamily: 'var(--font-code)',
            fontSize,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          <div className="px-3 py-2">
            {lines.map((line, row) => (
              <div key={row}>
                {line.split('').map((ch, col) => (
                  <span
                    key={`${row}-${col}`}
                    data-row={row}
                    data-col={col}
                    className={cn(
                      // Example: highlight current cursor "square"
                      row === cursor.row &&
                        col === cursor.col &&
                        'bg-blue-200/70 dark:bg-blue-800/70'
                    )}
                  >
                    {ch === ' ' ? '\u00A0' : ch}
                  </span>
                ))}
                {/* End-of-line caret position */}
                <span
                  data-row={row}
                  data-col={line.length}
                  className={cn(
                    row === cursor.row &&
                      cursor.col === line.length &&
                      'bg-blue-200/70 dark:bg-blue-800/70'
                  )}
                >
                  {'\u00A0'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Real textarea (handles input, wrap, scroll, caret) */}
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
          style={{
            fontSize,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
          }}
          spellCheck={false}
        />
      </div>
    </div>
  );
};
