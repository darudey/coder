'use client';

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
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
  const overlayScrollRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const [cursor, setCursor] = useState({ index: 0, row: 0, col: 0 });

  const lines = useMemo(() => code.split('\n'), [code]);
  const fontSize = settings.editorFontSize ?? 14;

  // 🔹 Shared editor style for BOTH textarea and overlay text
  const editorTextStyle = useMemo<React.CSSProperties>(
    () => ({
      fontFamily: 'var(--font-code)',
      fontSize,
      lineHeight: 1.5,
      whiteSpace: 'pre-wrap',
      overflowWrap: 'normal', // match both sides; no break-word here
      // @ts-ignore
      tabSize: 2,
    }),
    [fontSize]
  );

  // 🔹 Sync scroll of overlay & gutter with textarea
  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    const overlay = overlayScrollRef.current;
    const gutter = gutterRef.current;
    if (!ta) return;
    const top = ta.scrollTop;
    if (overlay) overlay.scrollTop = top;
    if (gutter) gutter.scrollTop = top;
  }, []);

  // 🔹 Update cursor info when textarea selection changes
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

  // When code changes from outside (file switch, undo), recompute cursor pos
  useEffect(() => {
    handleSelectionChange();
  }, [code, handleSelectionChange]);

  return (
    <div
      className="relative flex border rounded-md bg-background"
      style={{
        height: 'calc(100vh - 80px)',
        fontFamily: 'var(--font-code)',
        fontSize,
        lineHeight: 1.5,
      }}
    >
      {/* Gutter (line numbers) */}
      <div
        ref={gutterRef}
        className="w-10 shrink-0 border-r bg-muted text-xs text-muted-foreground overflow-hidden"
      >
        <div className="relative">
          {lines.map((_, i) => (
            <div
              key={i}
              className={cn(
                'px-2 h-[1.5em] flex items-center',
                i === cursor.row && 'text-foreground font-semibold'
              )}
              style={{ lineHeight: 1.5 }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Editor area */}
      <div className="relative flex-1 h-full">
        {/* Overlay with text, NOT per-char NBSP */}
        <div
          ref={overlayScrollRef}
          className="absolute inset-0 overflow-auto pointer-events-none"
        >
          <div className="px-3 py-2" style={editorTextStyle}>
            {lines.map((line, row) => {
              const isCursorLine = row === cursor.row;
              // Render whole line as text; we only use extra span to highlight cursor column
              if (!isCursorLine) {
                return (
                  <div key={row}>
                    {/* For empty line, ensure something is visible */}
                    {line === '' ? '\u00A0' : line}
                  </div>
                );
              }

              const before = line.slice(0, cursor.col);
              const atChar = line[cursor.col] ?? '';
              const after = line.slice(cursor.col + (atChar ? 1 : 0));

              // Special case: caret at end of line (after last char)
              const caretAtEOL = cursor.col === line.length;

              return (
                <div key={row}>
                  {caretAtEOL ? (
                    <>
                      {line === '' ? '\u00A0' : line}
                      <span className="bg-blue-200/70 dark:bg-blue-800/70">
                        {'\u00A0'}
                      </span>
                    </>
                  ) : (
                    <>
                      {before}
                      <span className="bg-blue-200/70 dark:bg-blue-800/70">
                        {atChar === ' ' ? ' ' : atChar}
                      </span>
                      {after}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Real textarea (controls input, caret, wrapping, scroll) */}
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
          style={editorTextStyle}
          spellCheck={false}
        />
      </div>
    </div>
  );
};
