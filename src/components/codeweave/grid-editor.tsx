

'use client';

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import * as acorn from 'acorn';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/hooks/use-settings';
import { parseCode, getTokenStyle } from '@/lib/syntax-highlighter';
import { ChevronDown } from 'lucide-react';


export interface OverlayEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
  activeLine?: number;
  lineExecutionCounts?: Record<number, number>;
}

interface FoldableRegion {
  start: number;
  end: number;
}

export const GridEditor: React.FC<OverlayEditorProps> = ({
  code,
  onCodeChange,
  activeLine = 0,
  lineExecutionCounts = {},
}) => {
  const { settings } = useSettings();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [cursorLine, setCursorLine] = useState(0);

  const [foldableRegions, setFoldableRegions] = useState<FoldableRegion[]>([]);
  const [collapsedLines, setCollapsedLines] = useState<Set<number>>(new Set());

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

  useEffect(() => {
    try {
      const regions: FoldableRegion[] = [];
      const tokens = acorn.tokenizer(code, {
        ecmaVersion: 'latest',
        locations: true,
      });

      const stack: { type: string, start: number }[] = [];

      for (const token of tokens) {
        if (token.type.label === '{') {
          stack.push({ type: 'brace', start: token.loc?.start.line - 1 ?? 0 });
        } else if (token.type.label === '}') {
          const last = stack.pop();
          if (last && last.type === 'brace') {
            const end = token.loc?.end.line - 1 ?? 0;
            if (end > last.start) {
              regions.push({ start: last.start, end: end });
            }
          }
        }
      }
      setFoldableRegions(regions);
    } catch (e) {
      // Ignore parsing errors for live editing
    }
  }, [code]);

  const isLineVisible = useCallback((lineNumber: number) => {
    for (const start of collapsedLines) {
      const region = foldableRegions.find(r => r.start === start);
      if (region && lineNumber > region.start && lineNumber <= region.end) {
        return false;
      }
    }
    return true;
  }, [collapsedLines, foldableRegions]);

  const visibleLines = useMemo(() => lines.filter((_, i) => isLineVisible(i)), [lines, isLineVisible]);

  const toggleFold = (lineNumber: number) => {
    setCollapsedLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineNumber)) {
        newSet.delete(lineNumber);
      } else {
        newSet.add(lineNumber);
      }
      return newSet;
    });
  };

  const computeWrappedRows = useCallback(() => {
    const measure = measureRef.current;
    const gutter = gutterRef.current;
    const ta = textareaRef.current;
    if (!measure || !gutter || !ta) return;

    measure.style.width = `${ta.clientWidth}px`;
    gutter.innerHTML = '';

    lines.forEach((line, i) => {
        const isFoldable = foldableRegions.some(r => r.start === i);
        const isCollapsed = collapsedLines.has(i);

        if (!isLineVisible(i) && i !== 0) return;

        const div = document.createElement('div');
        div.style.height = `${fontSize * 1.5}px`;
        div.className = 'flex items-center justify-end px-1 relative';

        const lineNumSpan = document.createElement('span');
        lineNumSpan.className = cn('text-xs text-muted-foreground', i === cursorLine && 'text-foreground font-semibold');
        lineNumSpan.textContent = String(i + 1);
        div.appendChild(lineNumSpan);
        
        if (isFoldable) {
            const chevron = document.createElement('div');
            chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>`;
            chevron.className = cn('absolute -left-1.5 cursor-pointer text-muted-foreground transition-transform', isCollapsed && '-rotate-90');
            chevron.onclick = (e) => {
                e.stopPropagation();
                toggleFold(i);
            };
            div.prepend(chevron);
        }
        
        if (isCollapsed) {
            const region = foldableRegions.find(r => r.start === i);
            if (region) {
                const collapsedIndicator = document.createElement('span');
                collapsedIndicator.textContent = ' ... ';
                collapsedIndicator.className = 'absolute left-full ml-1 px-1 rounded-sm bg-muted text-muted-foreground cursor-pointer';
                collapsedIndicator.onclick = () => toggleFold(i);
                div.appendChild(collapsedIndicator);

                // Adjust height for the single line
                div.style.height = `${fontSize * 1.5}px`;
                gutter.appendChild(div);

                // Skip rendering gutter lines for hidden lines
                let nextLine = region.end + 1;
                while(nextLine < lines.length && !isLineVisible(nextLine)) {
                    nextLine++;
                }
                i = nextLine - 1;
                return;
            }
        }
        gutter.appendChild(div);
    });
  }, [lines, fontSize, cursorLine, foldableRegions, collapsedLines, isLineVisible, toggleFold]);

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
  }, [code, computeWrappedRows, handleSelectionChange, collapsedLines]);

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const scrollTop = ta.scrollTop;
    if (overlayRef.current) overlayRef.current.style.transform = `translateY(-${scrollTop}px)`;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(-${scrollTop}px)`;
  }, []);
  
  const getHighlightStyle = (lineIndex: number): React.CSSProperties => {
    const count = lineExecutionCounts[lineIndex] || 0;
    if (count === 0) return {};

    const opacity = Math.min(0.1 + (count - 1) * 0.08, 0.7);
    return {
      backgroundColor: `rgba(34, 197, 94, ${opacity})`, // green-500 with variable opacity
      transition: 'background-color 0.3s ease',
    };
  };

  const highlightedCode = useMemo(() => {
    return lines.map((line, i) => {
        if (!isLineVisible(i)) return null;

        const isCollapsed = collapsedLines.has(i);
        const region = foldableRegions.find(r => r.start === i);

        return (
            <div 
              key={i} 
              className={cn(
                i === cursorLine && "bg-muted/50",
                "flex"
              )}
              style={getHighlightStyle(i)}
            >
              <div className="flex-grow">
                {isCollapsed && region ? (
                    <>
                        {parseCode(line).map((token, tokenIndex) => (
                            <span key={tokenIndex} style={getTokenStyle(token.type)}>
                                {token.value}
                            </span>
                        ))}
                        <span 
                            className="px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground cursor-pointer"
                            onClick={() => toggleFold(i)}
                        >...</span>
                        {parseCode('}').map((token, tokenIndex) => (
                            <span key={tokenIndex} style={getTokenStyle(token.type)}>
                                {token.value}
                            </span>
                        ))}
                    </>
                ) : (
                    line === '' ? <>&nbsp;</> : parseCode(line).map((token, tokenIndex) => (
                        <span key={tokenIndex} style={getTokenStyle(token.type)}>
                            {token.value}
                        </span>
                    ))
                )}
              </div>
            </div>
        );
    }).filter(Boolean);
  }, [lines, cursorLine, getHighlightStyle, isLineVisible, collapsedLines, foldableRegions, toggleFold]);

  return (
    <div
      className="relative flex border rounded-md bg-background min-h-[70vh] overflow-hidden"
    >
      {/* Gutter with dynamic wrapped rows */}
      <div
        ref={gutterRef}
        className="w-14 shrink-0 border-r bg-muted py-2"
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
            {highlightedCode}
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
