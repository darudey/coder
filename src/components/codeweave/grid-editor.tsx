'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/use-settings';

interface GridEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
}

const GridSquare = React.memo(function GridSquare({
  char,
  isCursor,
  row,
  col,
  onClick,
}: {
  char: string | null;
  isCursor: boolean;
  row: number;
  col: number;
  onClick: (row: number, col: number) => void;
}) {
  return (
    <div
      data-row={row}
      data-col={col}
      onClick={(e) => {
        e.stopPropagation();
        onClick(row, col);
      }}
      className={cn(
        'relative w-[1ch] h-[1.5em] flex items-center justify-center',
        isCursor ? 'bg-blue-200 dark:bg-blue-800' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
      )}
    >
      {char === ' ' ? '\u00A0' : char}
      {isCursor && (
        <div className="absolute left-0 top-0 h-full w-0.5 bg-blue-500 animate-pulse" />
      )}
    </div>
  );
});

const MemoizedGridEditor: React.FC<GridEditorProps> = ({ code, onCodeChange }) => {
  const { settings } = useSettings();
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [cursor, setCursor] = useState({ row: 0, col: 0 });

  const lines = code.split('\n');

  // Clamp cursor whenever code changes from outside (file switch, undo, etc.)
  useEffect(() => {
    if (lines.length === 0) {
      if (cursor.row !== 0 || cursor.col !== 0) {
        setCursor({ row: 0, col: 0 });
      }
      return;
    }

    let row = Math.min(cursor.row, lines.length - 1);
    row = Math.max(0, row);

    const maxCol = lines[row]?.length ?? 0;
    let col = Math.min(cursor.col, maxCol);
    col = Math.max(0, col);

    if (row !== cursor.row || col !== cursor.col) {
      setCursor({ row, col });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]); // depend only on code so it runs on external changes

  const handleCharClick = useCallback((row: number, col: number) => {
    setCursor({ row, col });
    hiddenTextareaRef.current?.focus();
  }, []);

  useEffect(() => {
    hiddenTextareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const key = e.key;

    // Always recompute from latest code
    const currentLines = [...lines];
    let { row, col } = cursor;

    if (currentLines.length === 0) {
      currentLines.push('');
      row = 0;
      col = 0;
    }

    switch (key) {
      case 'ArrowUp':
        row = Math.max(0, row - 1);
        col = Math.min(currentLines[row].length, col);
        break;

      case 'ArrowDown':
        row = Math.min(currentLines.length - 1, row + 1);
        col = Math.min(currentLines[row].length, col);
        break;

      case 'ArrowLeft':
        if (col > 0) col--;
        else if (row > 0) {
          row--;
          col = currentLines[row].length;
        }
        break;

      case 'ArrowRight':
        if (col < currentLines[row].length) col++;
        else if (row < currentLines.length - 1) {
          row++;
          col = 0;
        }
        break;

      case 'Enter': {
        const before = currentLines[row].slice(0, col);
        const after = currentLines[row].slice(col);
        currentLines[row] = before;
        currentLines.splice(row + 1, 0, after);
        row++;
        col = 0;
        break;
      }

      case 'Backspace': {
        if (col > 0) {
          currentLines[row] =
            currentLines[row].slice(0, col - 1) + currentLines[row].slice(col);
          col--;
        } else if (row > 0) {
          const prevLength = currentLines[row - 1].length;
          currentLines[row - 1] += currentLines[row];
          currentLines.splice(row, 1);
          row--;
          col = prevLength;
        }
        break;
      }

      case 'Delete': {
        if (col < currentLines[row].length) {
          currentLines[row] =
            currentLines[row].slice(0, col) + currentLines[row].slice(col + 1);
        } else if (row < currentLines.length - 1) {
          currentLines[row] += currentLines[row + 1];
          currentLines.splice(row + 1, 1);
        }
        break;
      }

      default: {
        if (key.length === 1) {
          currentLines[row] =
            currentLines[row].slice(0, col) + key + currentLines[row].slice(col);
          col++;
        }
        break;
      }
    }

    onCodeChange(currentLines.join('\n'));
    setCursor({ row, col });
  };

  // Keep cursor in view when moving around (with wrap)
  useEffect(() => {
    const container = editorRef.current;
    if (!container) return;

    const square = container.querySelector(
      `[data-row="${cursor.row}"][data-col="${cursor.col}"]`
    ) as HTMLElement | null;

    if (square) {
      square.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [cursor]);

  return (
    <div
      ref={editorRef}
      className={cn(
        'font-code p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg cursor-text',
        'h-[calc(100vh-80px)] overflow-auto'
      )}
      style={{
        fontSize: `${settings.editorFontSize}px`,
        lineHeight: '1.5',
      }}
      onClick={() => hiddenTextareaRef.current?.focus()}
    >
      {lines.map((line, row) => (
        <div key={row} className="flex items-start">
          <div className="text-right pr-4 text-gray-500 w-10 select-none">
            {row + 1}
          </div>

          <div className="flex">
            {line.split('').map((ch, col) => (
              <GridSquare
                key={`${row}-${col}`}
                char={ch}
                row={row}
                col={col}
                isCursor={cursor.row === row && cursor.col === col}
                onClick={handleCharClick}
              />
            ))}

            <GridSquare
              key={`${row}-eol`}
              char={null}
              row={row}
              col={line.length}
              isCursor={cursor.row === row && cursor.col === line.length}
              onClick={handleCharClick}
            />
          </div>
        </div>
      ))}

      <textarea
        ref={hiddenTextareaRef}
        onKeyDown={handleKeyDown}
        value={code}
        onChange={() => {}}
        className="absolute opacity-0 w-0 h-0"
        spellCheck="false"
      />
    </div>
  );
};

export const GridEditor = React.memo(MemoizedGridEditor);
