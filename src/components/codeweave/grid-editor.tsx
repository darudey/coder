
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/use-settings';

interface GridEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDeleteFile?: () => void;
  hasActiveFile?: boolean;
  onRun?: () => void;
}

// A memoized component for a single square to optimize rendering and stabilize event handlers.
const GridSquare = React.memo(function GridSquare({
    char,
    isCursor,
    isEndOfLine,
    onClick,
}: {
    char: string | null;
    isCursor: boolean;
    isEndOfLine: boolean;
    onClick: () => void;
}) {
    return (
        <div
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

    const handleContainerClick = () => {
        hiddenTextareaRef.current?.focus();
    };

    const handleCharClick = useCallback((row: number, col: number) => {
        setCursor({ row, col });
        hiddenTextareaRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const { key } = e;
        let { row, col } = cursor;
        let currentLines = code.split('\n');

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
                if (col > 0) {
                    col--;
                } else if (row > 0) {
                    row--;
                    col = currentLines[row].length;
                }
                break;
            case 'ArrowRight':
                if (col < currentLines[row].length) {
                    col++;
                } else if (row < currentLines.length - 1) {
                    row++;
                    col = 0;
                }
                break;
            case 'Enter':
                const line = currentLines[row];
                const textBefore = line.substring(0, col);
                const textAfter = line.substring(col);
                currentLines[row] = textBefore;
                currentLines.splice(row + 1, 0, textAfter);
                row++;
                col = 0;
                break;
            case 'Backspace':
                 if (col > 0) {
                    const line = currentLines[row];
                    currentLines[row] = line.slice(0, col - 1) + line.slice(col);
                    col--;
                } else if (row > 0) {
                    const prevLineLength = currentLines[row - 1].length;
                    currentLines[row - 1] += currentLines[row];
                    currentLines.splice(row, 1);
                    row--;
                    col = prevLineLength;
                }
                break;
            case 'Delete':
                if (col < currentLines[row].length) {
                    const line = currentLines[row];
                    currentLines[row] = line.slice(0, col) + line.slice(col + 1);
                } else if (row < currentLines.length - 1) {
                    currentLines[row] += currentLines[row + 1];
                    currentLines.splice(row + 1, 1);
                }
                break;
             default:
                if (key.length === 1) { // Regular character input
                    const line = currentLines[row];
                    currentLines[row] = line.substring(0, col) + key + line.substring(col);
                    col++;
                }
                break;
        }
        
        onCodeChange(currentLines.join('\n'));
        setCursor({ row, col });
    };

    // Ensure textarea is focused on mount
    useEffect(() => {
        hiddenTextareaRef.current?.focus();
    }, []);

    return (
        <div 
            ref={editorRef}
            onClick={handleContainerClick}
            className="font-code p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg cursor-text min-h-[70vh]"
            style={{ fontSize: `${settings.editorFontSize}px`, lineHeight: '1.5' }}
        >
            {lines.map((line, rowIndex) => (
                <div key={rowIndex} className="flex items-center">
                    <div className="text-right pr-4 text-gray-500 select-none w-12">
                        {rowIndex + 1}
                    </div>
                    <div className="flex">
                        {line.split('').map((char, colIndex) => (
                           <GridSquare
                                key={`${rowIndex}-${colIndex}`}
                                char={char}
                                isCursor={rowIndex === cursor.row && colIndex === cursor.col}
                                isEndOfLine={false}
                                onClick={() => handleCharClick(rowIndex, colIndex)}
                           />
                        ))}
                         <GridSquare
                            key={`${rowIndex}-${line.length}`}
                            char={null}
                            isCursor={rowIndex === cursor.row && line.length === cursor.col}
                            isEndOfLine={true}
                            onClick={() => handleCharClick(rowIndex, line.length)}
                         />
                    </div>
                </div>
            ))}
            <textarea 
                ref={hiddenTextareaRef}
                onKeyDown={handleKeyDown}
                className="absolute opacity-0 w-0 h-0"
                value={code} // Keep textarea value in sync for accessibility
                onChange={() => {}} // onChange is handled by onKeyDown
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck="false"
            />
        </div>
    );
};

export const GridEditor = React.memo(MemoizedGridEditor);
