

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

const findMatchingBracket = (code: string, position: number): [number, number] | null => {
    const singleCharPairs: { [key: string]: string } = { '(': ')', '{': '}', '[': ']', ')': '(', '}': '{', ']': '[' };
    const multiCharDelimiters = ["'''", '"""'];

    // Function to find single character pairs
    const findSingleCharPair = (startPos: number): [number, number] | null => {
        const char = code[startPos];
        const closeChar = singleCharPairs[char];
        if (!closeChar || !['(', '{', '['].includes(char)) return null;

        let balance = 1;
        for (let i = startPos + 1; i < code.length; i++) {
            if (code[i] === char) balance++;
            else if (code[i] === closeChar) balance--;
            if (balance === 0) return [startPos, i];
        }
        return null;
    };
    
    // Function to find multi-character pairs
    const findMultiCharPair = (delimiter: string, startPos: number): [number, number] | null => {
        const nextOccurrence = code.indexOf(delimiter, startPos + delimiter.length);
        if (nextOccurrence !== -1) {
            return [startPos, nextOccurrence + delimiter.length - 1];
        }
        return null;
    };

    let bestPair: [number, number] | null = null;
    let closestDistance = Infinity;

    // Check for enclosing single-character brackets
    for (let i = position - 1; i >= 0; i--) {
        if (['(', '{', '['].includes(code[i])) {
            const pair = findSingleCharPair(i);
            if (pair && position > pair[0] && position <= pair[1]) {
                const distance = position - pair[0];
                if (distance < closestDistance) {
                    closestDistance = distance;
                    bestPair = pair;
                }
            }
        }
    }
    
    // Check for enclosing multi-character delimiters
    for (const delim of multiCharDelimiters) {
        let lastIndex = -1;
        while ((lastIndex = code.lastIndexOf(delim, position - delim.length)) !== -1) {
            const pair = findMultiCharPair(delim, lastIndex);
            if (pair && position > pair[0] && position <= pair[1] + 1) {
                const distance = position - pair[0];
                 if (distance < closestDistance) {
                    closestDistance = distance;
                    bestPair = [pair[0], pair[1] +1]; // Adjust for inclusive end
                }
            }
            if (lastIndex === 0) break;
            position = lastIndex; // Continue search from before this found delimiter
        }
    }

    return bestPair;
};


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
  const [matchedBrackets, setMatchedBrackets] = useState<[number, number] | null>(null);

  const fontSize = settings.editorFontSize ?? 14;

  const textStyle = useMemo<React.CSSProperties>(() => ({
    fontFamily: 'var(--font-code)',
    fontSize,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: 'normal',
    tabSize: 4,
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
    for (const collapsedStartLine of collapsedLines) {
        const region = foldableRegions.find(r => r.start === collapsedStartLine);
        if (region && lineNumber > region.start && lineNumber <= region.end) {
            return false;
        }
    }
    return true;
  }, [collapsedLines, foldableRegions]);

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
    const maxLineNumber = lines.length;
    const gutterWidth = String(maxLineNumber).length * (fontSize * 0.6) + 32; // char width + padding + icon
    gutter.style.width = `${gutterWidth}px`;


    for (let i = 0; i < lines.length; i++) {
        if (!isLineVisible(i)) continue;

        const text = lines[i] === '' ? '\u00A0' : lines[i];
        measure.textContent = text;
        // PATCH: Ensure measure div wraps exactly like editor
        measure.style.whiteSpace = 'pre-wrap';
        measure.style.overflowWrap = 'anywhere';
        
        // PATCHED: true wrapped height
        const height = Math.max(measure.offsetHeight, fontSize * 1.5);

        const div = document.createElement('div');
        div.style.height = `${height}px`;
        div.className = 'flex items-center justify-end px-2 gap-1';

        const lineNumSpan = document.createElement('span');
        lineNumSpan.className = cn('text-xs text-muted-foreground', i === cursorLine && 'text-foreground font-semibold');
        lineNumSpan.textContent = String(i + 1);
        
        div.appendChild(lineNumSpan);
        
        const isFoldable = foldableRegions.some(r => r.start === i);
        const isCollapsed = collapsedLines.has(i);
        
        if (isFoldable) {
            const chevronWrapper = document.createElement('div');
            chevronWrapper.className = cn('cursor-pointer text-muted-foreground transition-transform', isCollapsed && '-rotate-90');
            chevronWrapper.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>`;
            chevronWrapper.onclick = (e) => {
                e.stopPropagation();
                toggleFold(i);
            };
            div.appendChild(chevronWrapper);
        } else {
            const placeholder = document.createElement('div');
            placeholder.style.width = '14px';
            div.appendChild(placeholder);
        }
        
        gutter.appendChild(div);
    }
  }, [lines, fontSize, cursorLine, foldableRegions, collapsedLines, isLineVisible, toggleFold]);

  const handleSelectionChange = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const index = ta.selectionStart ?? 0;
    
    let line = 0;
    let charPos = 0;
    for (let i = 0; i < index; i++) {
        if (code[i] === '\n') {
            line++;
            charPos = 0;
        } else {
            charPos++;
        }
    }
    setCursorLine(line);
    setMatchedBrackets(findMatchingBracket(code, index));

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
    let currentPos = 0;
    return lines.map((line, i) => {
        if (!isLineVisible(i)) {
          currentPos += line.length + 1;
          return null;
        };

        const isCollapsed = collapsedLines.has(i);
        const region = foldableRegions.find(r => r.start === i);
        const lineStartPos = currentPos;

        const renderTokens = (text: string, startOffset: number = 0) => {
          let textPos = 0;
          return parseCode(text).map((token, tokenIndex) => {
              const tokenStart = lineStartPos + startOffset + textPos;
              const tokenEnd = tokenStart + token.value.length;
              
              const isBracketMatch = matchedBrackets && (
                (tokenStart >= matchedBrackets[0] && tokenEnd <= matchedBrackets[0] + 1) ||
                (tokenStart >= matchedBrackets[1] && tokenEnd <= matchedBrackets[1] + 1)
              );

              textPos += token.value.length;

              return (
                  <span
                      key={tokenIndex}
                      className={cn(isBracketMatch && "bracket-match")}
                      style={{
                      ...getTokenStyle(token.type),
                      display: 'inline',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      wordBreak: 'normal',
                      }}
                  >
                      {token.value}
                  </span>
              );
          })
        };

        const lineContent = isCollapsed && region ? (
            <>
                {renderTokens(line)}
                <span 
                    className="px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground cursor-pointer"
                    style={{ display: 'inline', whiteSpace: 'pre-wrap' }}
                    onClick={() => toggleFold(i)}
                >...</span>
                {renderTokens('}', line.length + 3)}
            </>
        ) : (
            line === '' ? <>&nbsp;</> : renderTokens(line)
        );
        
        currentPos += line.length + 1;

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
                {lineContent}
              </div>
            </div>
        );
    }).filter(Boolean);
  }, [lines, cursorLine, getHighlightStyle, isLineVisible, collapsedLines, foldableRegions, toggleFold, matchedBrackets]);

  return (
    <div
      className="relative flex border rounded-md bg-background min-h-[70vh] overflow-hidden"
    >
      {/* Gutter with dynamic wrapped rows */}
      <div
        ref={gutterRef}
        className="shrink-0 border-r bg-muted py-2"
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
          style={{
            ...textStyle,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            wordBreak: 'normal',
          }}
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
