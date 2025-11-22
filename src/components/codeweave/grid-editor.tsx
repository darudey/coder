
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
  onClick: () => void;
}) {
  return (
    <div
      data-row={row}
      data-col={col}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "relative w-[1ch] h-[1.5em] flex items-center justify-center",
        isCursor ? "bg-blue-200 dark:bg-blue-800" : "hover:bg-gray-200 dark:hover:bg-gray-700"
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

  const handleCharClick = (row: number, col: number) => {
    setCursor({ row, col });
    hiddenTextareaRef.current?.focus();
  };

  useEffect(() => {
    hiddenTextareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const key = e.key;

    let { row, col } = cursor;
    let currentLines = [...lines];

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

      case 'Enter':
        const before = currentLines[row].slice(0, col);
        const after = currentLines[row].slice(col);
        currentLines[row] = before;
        currentLines.splice(row + 1, 0, after);
        row++;
        col = 0;
        break;

      case 'Backspace':
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

      default:
        if (key.length === 1) {
          currentLines[row] =
            currentLines[row].slice(0, col) +
            key +
            currentLines[row].slice(col);
          col++;
        }
        break;
    }

    onCodeChange(currentLines.join('\n'));
    setCursor({ row, col });
  };

  // ⭐ Scroll cursor into view
  useEffect(() => {
    const container = editorRef.current;
    if (!container) return;

    const square = container.querySelector(
      `[data-row="${cursor.row}"][data-col="${cursor.col}"]`
    ) as HTMLElement | null;

    if (square) {
      const rect = square.getBoundingClientRect();
      const crect = container.getBoundingClientRect();

      if (rect.top < crect.top + 60 || rect.bottom > crect.bottom - 60) {
        square.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }, [cursor]);

  return (
    <div
      ref={editorRef}
      className="
        font-code p-4 bg-white dark:bg-gray-800 
        rounded-lg shadow-lg cursor-text 
        h-[calc(100vh-80px)] overflow-y-auto
      "
      style={{
        fontSize: `${settings.editorFontSize}px`,
        lineHeight: "1.5",
      }}
      onClick={() => hiddenTextareaRef.current?.focus()}
    >
      {lines.map((line, row) => (
        <div key={row} className="flex">
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
                onClick={() => handleCharClick(row, col)}
              />
            ))}

            {/* End of line position */}
            <GridSquare
              key={`${row}-eol`}
              char={null}
              row={row}
              col={line.length}
              isCursor={cursor.row === row && cursor.col === line.length}
              onClick={() => handleCharClick(row, line.length)}
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
