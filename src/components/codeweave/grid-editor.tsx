
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/use-settings';
import { FixedSizeList as List } from 'react-window';

interface GridEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
}

const GridSquare = React.memo(function GridSquare({
  char,
  isCursor,
}: {
  char: string | null;
  isCursor: boolean;
}) {
  return (
    <div
      className={cn(
        'relative w-[1ch] h-[1.5em] flex items-center justify-center',
        isCursor ? 'bg-blue-200 dark:bg-blue-800' : ''
      )}
    >
      {char === ' ' ? '\u00A0' : char}
      {isCursor && (
        <div className="absolute left-0 top-0 h-full w-0.5 bg-blue-500 animate-pulse" />
      )}
    </div>
  );
});

const Line = React.memo(function Line({
  line,
  row,
  cursor,
  onCharClick,
}: {
  line: string;
  row: number;
  cursor: { row: number; col: number };
  onCharClick: (row: number, col: number) => void;
}) {
  return (
    <div className="flex items-start">
      <div className="text-right pr-4 text-gray-500 w-10 select-none">
        {row + 1}
      </div>
      <div className="flex" onClick={(e) => {
          const target = e.target as HTMLElement;
          const colAttr = target.getAttribute('data-col');
          if (colAttr) {
            onCharClick(row, parseInt(colAttr, 10));
          } else {
            // Clicked on the line but not a specific char, go to end
            onCharClick(row, line.length);
          }
      }}>
        {line.split('').map((ch, col) => (
          <div key={col} data-col={col} className="hover:bg-gray-200 dark:hover:bg-gray-700">
             <GridSquare
                char={ch}
                isCursor={cursor.row === row && cursor.col === col}
              />
          </div>
        ))}
        <div data-col={line.length} className="hover:bg-gray-200 dark:hover:bg-gray-700">
            <GridSquare
                char={null}
                isCursor={cursor.row === row && cursor.col === line.length}
            />
        </div>
      </div>
    </div>
  );
});

const MemoizedGridEditor: React.FC<GridEditorProps> = ({ code, onCodeChange }) => {
  const { settings } = useSettings();
  const hiddenTextareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState({ row: 0, col: 0 });

  const lines = code.split('\n');
  const lineHeight = Math.round(settings.editorFontSize * 1.5);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
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
  }, [code, cursor.row, cursor.col, lines]);

  const handleCharClick = useCallback((row: number, col: number) => {
    setCursor({ row, col });
    hiddenTextareaRef.current?.focus();
  }, []);

  useEffect(() => {
    hiddenTextareaRef.current?.focus();
  }, []);
  
  useEffect(() => {
    if (listRef.current) {
        listRef.current.scrollToItem(cursor.row, 'smart');
    }
  }, [cursor.row]);


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const key = e.key;

    const currentLines = [...lines];
    let { row, col } = cursor;

    if (currentLines.length === 0) {
      currentLines.push('');
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
          currentLines[row] = currentLines[row].slice(0, col - 1) + currentLines[row].slice(col);
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
          currentLines[row] = currentLines[row].slice(0, col) + currentLines[row].slice(col + 1);
        } else if (row < currentLines.length - 1) {
          currentLines[row] += currentLines[row + 1];
          currentLines.splice(row + 1, 1);
        }
        break;
      }
      default: {
        if (key.length === 1) {
          currentLines[row] = currentLines[row].slice(0, col) + key + currentLines[row].slice(col);
          col++;
        }
        break;
      }
    }

    onCodeChange(currentLines.join('\n'));
    setCursor({ row, col });
  };

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    return (
      <div style={style}>
        <Line
          line={lines[index]}
          row={index}
          cursor={cursor}
          onCharClick={handleCharClick}
        />
      </div>
    );
  }, [lines, cursor, handleCharClick]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'font-code p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg cursor-text',
        'h-[calc(100vh-80px)] overflow-hidden'
      )}
      style={{
        fontSize: `${settings.editorFontSize}px`,
        lineHeight: '1.5',
      }}
      onClick={() => hiddenTextareaRef.current?.focus()}
    >
      <List
        ref={listRef}
        height={containerSize.height - 32} // Account for padding
        itemCount={lines.length}
        itemSize={lineHeight}
        width={containerSize.width - 32} // Account for padding
      >
        {Row}
      </List>

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
