

'use client';

import React from 'react';
import * as acorn from 'acorn';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from '@/hooks/use-settings';
import { parseCode, getTokenStyle } from '@/lib/syntax-highlighter';
import { ChevronDown } from 'lucide-react';
import { AutocompleteDropdown } from './autocomplete-dropdown';
import { getSuggestions, type Suggestion } from '@/lib/autocomplete';
import { useDebounce } from '@/hooks/use-debounce';
import { getCaretCoordinates } from '@/lib/caret-position';
import { getSmartIndentation } from '@/lib/indentation';
import 'acorn-walk';


export interface OverlayEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
  activeLine?: number;
  lineExecutionCounts?: Record<number, number>;
  onUndo: () => void;
  onRedo: () => void;
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
        let searchPos = position - 1;
        while(searchPos >= 0) {
            const lastIndex = code.lastIndexOf(delim, searchPos);
            if (lastIndex === -1) break;

            const pair = findMultiCharPair(delim, lastIndex);
            if (pair && position > pair[0] && position <= pair[1] + 1) {
                const distance = position - pair[0];
                 if (distance < closestDistance) {
                    closestDistance = distance;
                    bestPair = [pair[0], pair[1]];
                }
            }
            searchPos = lastIndex - 1;
        }
    }

    return bestPair;
};


export const GridEditor: React.FC<OverlayEditorProps> = ({
  code,
  onCodeChange,
  activeLine = 0,
  lineExecutionCounts = {},
  onUndo,
  onRedo,
}) => {
  const { settings } = useSettings();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const gutterRef = React.useRef<HTMLDivElement | null>(null);
  const measureRef = React.useRef<HTMLDivElement | null>(null);
  const [cursorLine, setCursorLine] = React.useState(0);

  const [foldableRegions, setFoldableRegions] = React.useState<FoldableRegion[]>([]);
  const [collapsedLines, setCollapsedLines] = React.useState<Set<number>>(new Set());
  const [matchedBrackets, setMatchedBrackets] = React.useState<[number, number] | null>(null);
  const [lineHeights, setLineHeights] = React.useState<number[]>([]);

  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [suggestionPos, setSuggestionPos] = React.useState<Partial<React.CSSProperties>>({});
  const [activeSuggestion, setActiveSuggestion] = React.useState(0);
  const debouncedCode = useDebounce(code, 150);

  const fontSize = settings.editorFontSize ?? 14;

  const textStyle = React.useMemo<React.CSSProperties>(() => ({
    fontFamily: 'var(--font-code)',
    fontSize,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: 'normal',
    tabSize: 4,
  }), [fontSize]);

  const lines = React.useMemo(() => code.split('\n'), [code]);

    const updateSuggestions = React.useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const { suggestions: newSuggestions, word } = getSuggestions(code, textarea.selectionStart, false);
        if (newSuggestions.length > 0) {
            setSuggestions(newSuggestions);
            setActiveSuggestion(0);
            
            const coords = getCaretCoordinates(textarea, textarea.selectionStart);
            const editorRect = textarea.getBoundingClientRect();
            const dropdownWidth = 200; // Approximate width of the dropdown
            const dropdownHeight = 200; // Approximate height of the dropdown

            let newPos: Partial<React.CSSProperties> = {};

            // Horizontal positioning
            if (coords.left + dropdownWidth > editorRect.width) {
                newPos.right = editorRect.width - coords.left;
            } else {
                newPos.left = coords.left;
            }
            
            // Vertical positioning
            if (coords.top + coords.height + dropdownHeight > editorRect.height) {
                newPos.bottom = editorRect.height - coords.top;
            } else {
                newPos.top = coords.top + coords.height;
            }

            setSuggestionPos(newPos);
        } else {
            setSuggestions([]);
        }
    }, [code]);

  React.useEffect(() => {
    updateSuggestions();
  }, [debouncedCode, updateSuggestions]);

  React.useEffect(() => {
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

  const isLineVisible = React.useCallback((lineNumber: number) => {
    for (const collapsedStartLine of collapsedLines) {
        const region = foldableRegions.find(r => r.start === collapsedStartLine);
        if (region && lineNumber > region.start && lineNumber <= region.end) {
            return false;
        }
    }
    return true;
  }, [collapsedLines, foldableRegions]);

  const toggleFold = React.useCallback((lineNumber: number) => {
    setCollapsedLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineNumber)) {
        newSet.delete(lineNumber);
      } else {
        newSet.add(lineNumber);
      }
      return newSet;
    });
  }, []);

  const computeWrappedRows = React.useCallback(() => {
    const measure = measureRef.current;
    const ta = textareaRef.current;
    if (!measure || !ta) return;

    const computedStyle = getComputedStyle(ta);
    const paddingLeft = parseFloat(computedStyle.paddingLeft || '0');
    const paddingRight = parseFloat(computedStyle.paddingRight || '0');
    measure.style.width = `${ta.clientWidth - paddingLeft - paddingRight}px`;

    const heights: number[] = [];

    for (let i = 0; i < lines.length; i++) {
        if (!isLineVisible(i)) {
        heights.push(0);
        continue;
        }

        const text = lines[i] === '' ? '\u00A0' : lines[i];
        measure.textContent = text;

        const height =
        measure.offsetHeight ||
        parseFloat(getComputedStyle(measure).lineHeight || `${fontSize * 1.5}px`);

        heights.push(height);
    }

    setLineHeights(heights);
  }, [lines, fontSize, isLineVisible]);

  const handleSelectionChange = React.useCallback(() => {
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

  const handleEnterPress = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const { textToInsert, newCursorPosition } = getSmartIndentation(code, start, end);
    
    const newCode = code.substring(0, start) + textToInsert + code.substring(end);
    onCodeChange(newCode);
    
    requestAnimationFrame(() => {
        textarea.selectionStart = newCursorPosition;
        textarea.selectionEnd = newCursorPosition;
        textarea.focus();
    });
}, [code, onCodeChange]);

  const handleNavigateSuggestions = React.useCallback((direction: 'next' | 'prev') => {
      if (suggestions.length === 0) return;
      if (direction === 'next') {
          setActiveSuggestion(prev => (prev + 1) % suggestions.length);
      } else {
          setActiveSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length);
      }
  }, [suggestions.length]);

  const handleSuggestionSelection = React.useCallback((suggestion: Suggestion) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { word, startPos } = getSuggestions(code, textarea.selectionStart, false);
    
    const newCode = code.substring(0, startPos) + suggestion.value + code.substring(textarea.selectionStart);
    const newCursorPosition = startPos + suggestion.value.length;
    
    onCodeChange(newCode);
    setSuggestions([]);

    requestAnimationFrame(() => {
        textarea.selectionStart = newCursorPosition;
        textarea.selectionEnd = newCursorPosition;
        textarea.focus();
    });
  }, [code, onCodeChange]);

    const handleNativeKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        if (e.ctrlKey || e.metaKey) {
            if (e.key.toLowerCase() === 'z') {
                e.preventDefault();
                onUndo();
                return;
            }
            if (e.key.toLowerCase() === 'y') {
                e.preventDefault();
                onRedo();
                return;
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const lines = code.split('\n');
            
            let startLine = code.substring(0, start).split('\n').length - 1;
            let endLine = code.substring(0, end).split('\n').length - 1;

            if (end > 0 && code[end-1] === '\n') {
                endLine--;
            }

            const linesToToggle = lines.slice(startLine, endLine + 1);
            const areAllCommented = linesToToggle.every(line => line.trim().startsWith('//'));
            
            let newLines = [...lines];
            let charChange = 0;
            let firstLineChange = 0;

            for (let i = startLine; i <= endLine; i++) {
                if (areAllCommented) {
                    const originalLine = newLines[i];
                    newLines[i] = newLines[i].replace(/^\s*\/\/\s?/, '');
                    const change = originalLine.length - newLines[i].length;
                    if (i === startLine) firstLineChange = -change;
                    charChange -= change;
                } else {
                    newLines[i] = `// ${newLines[i]}`;
                    if (i === startLine) firstLineChange = 3;
                    charChange += 3;
                }
            }
            
            const newCode = newLines.join('\n');
            onCodeChange(newCode);

            requestAnimationFrame(() => {
                textarea.selectionStart = start + firstLineChange;
                textarea.selectionEnd = end + charChange;
                textarea.focus();
            });
            return;
        }

        if ((e.shiftKey || e.altKey) && e.key === ' ') {
            e.preventDefault();
            if (suggestions.length > 0) {
                // If suggestions are open, navigate them
                handleNavigateSuggestions('next');
            } else {
                // Otherwise, perform quick-jump
                const currentPos = textarea.selectionStart;
                const textAfter = code.substring(currentPos);
                
                if (textAfter.length > 0) {
                    const match = textAfter.match(/(\s+)|(\w+)|(\S)/);
                    if (match) {
                        const jumpTo = currentPos + (match.index || 0) + match[0].length;
                        requestAnimationFrame(() => {
                            textarea.selectionStart = jumpTo;
                            textarea.selectionEnd = jumpTo;
                        });
                    }
                }
            }
            return;
        }

        if (suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleNavigateSuggestions('next');
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                handleNavigateSuggestions('prev');
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                handleSuggestionSelection(suggestions[activeSuggestion]);
                return;
            }
            if (e.key === 'Escape') {
                setSuggestions([]);
                return;
            }
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            handleEnterPress();
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newCode = code.substring(0, start) + '    ' + code.substring(end);
            onCodeChange(newCode);
            requestAnimationFrame(() => {
                textarea.selectionStart = start + 4;
                textarea.selectionEnd = start + 4;
                textarea.focus();
            });
            return;
        }

        if (e.key === 'Backspace') {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            if (start === end && start > 0) {
                const charBefore = code.charAt(start - 1);
                const charAfter = code.charAt(start);
                const pairs: { [key: string]: string } = { '(': ')', '{': '}', '[': ']', "'": "'", '"': '"', '`': '`'};

                if (pairs[charBefore] === charAfter) {
                    e.preventDefault();
                    const newCode = code.substring(0, start - 1) + code.substring(start + 1);
                    onCodeChange(newCode);
                    
                    requestAnimationFrame(() => {
                        textarea.selectionStart = start - 1;
                        textarea.selectionEnd = start - 1;
                        textarea.focus();
                    });
                    return;
                }
            }
        }
        
        const pairMap: {[key:string]: string} = { '(': ')', '{': '}', '[': ']', "'": "'", '"': '"', '`': '`' };

        if (pairMap[e.key]) {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const open = e.key;
            const close = pairMap[e.key];
            
            let newCode;
            let newCursorPosition;

            if (start === end) {
                newCode = code.substring(0, start) + open + close + code.substring(end);
                newCursorPosition = start + 1;
            } else {
                const selectedText = code.substring(start, end);
                newCode = code.substring(0, start) + open + selectedText + close + code.substring(end);
                newCursorPosition = start + open.length + selectedText.length + close.length;
            }
            
            onCodeChange(newCode);

            requestAnimationFrame(() => {
                if (start === end) {
                    textarea.selectionStart = newCursorPosition;
                    textarea.selectionEnd = newCursorPosition;
                } else {
                    textarea.selectionStart = start + open.length;
                    textarea.selectionEnd = end + open.length;
                }
                textarea.focus();
            });
            return;
        }

    }, [code, onCodeChange, onUndo, onRedo, suggestions, activeSuggestion, handleSuggestionSelection, handleEnterPress, handleNavigateSuggestions]);

  React.useEffect(() => {
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
        if(document) {
          document.removeEventListener('selectionchange', handler);
        }
        if (ta) {
          ta.removeEventListener('keyup', handler);
          ta.removeEventListener('click', handler);
        }
    };
  }, [handleSelectionChange, computeWrappedRows]);

  React.useEffect(() => {
    computeWrappedRows();
    handleSelectionChange();
  }, [code, computeWrappedRows, handleSelectionChange, collapsedLines]);

  const syncScroll = React.useCallback(() => {
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

  const highlightedCode = React.useMemo(() => {
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
                i === cursorLine && "bg-slate-700/50",
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

  const gutterRows = React.useMemo(() => {
    return lines.map((line, i) => {
      if (!isLineVisible(i)) return null;

      const isFoldable = foldableRegions.some(r => r.start === i);
      const isCollapsed = collapsedLines.has(i);
      const height = lineHeights[i] ?? (fontSize * 1.5);

      return (
        <div
          key={i}
          className="flex items-start justify-end px-2 gap-1"
          style={{
            height,
            fontFamily: 'var(--font-code)',
            fontSize,
            lineHeight: 1.5,
          }}
        >
          {/* Line number */}
          <span
            className={cn(
              'text-xs text-muted-foreground',
              i === cursorLine && 'text-foreground font-semibold'
            )}
          >
            {i + 1}
          </span>

          {/* Folding icon or placeholder */}
          {isFoldable ? (
            <div
              className={cn(
                'cursor-pointer text-muted-foreground transition-transform',
                isCollapsed && '-rotate-90'
              )}
              onClick={() => toggleFold(i)}
            >
              <ChevronDown size={14} />
            </div>
          ) : (
            <div style={{ width: 14 }} />
          )}
        </div>
      );
    });
  }, [
    lines,
    lineHeights,
    fontSize,
    cursorLine,
    foldableRegions,
    collapsedLines,
    isLineVisible,
    toggleFold,
  ]);

  return (
    <div
      className="relative flex border rounded-md bg-white dark:bg-[#202938] min-h-[70vh]"
    >
        <div
            ref={gutterRef}
            className="shrink-0 border-r bg-gray-100 dark:bg-[#111828] py-2"
            style={{
                fontFamily: 'var(--font-code)',
                fontSize,
                lineHeight: 1.5,
                willChange: 'transform',
            }}
        >
            {gutterRows}
        </div>


      {/* Editor area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Overlay text mirror */}
        <div
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none px-3 py-2"
          style={{
            ...textStyle,
          }}
        >
            {highlightedCode}
        </div>

        {/* REAL textarea */}
        <Textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          onKeyDown={handleNativeKeyDown}
          onScroll={syncScroll}
          className={cn(
            'absolute inset-0 w-full h-full resize-none border-0 bg-transparent',
            'focus-visible:ring-0 focus-visible:ring-offset-0 text-transparent caret-foreground',
            'px-3 py-2'
          )}
          style={textStyle}
          spellCheck={false}
        />
        
        {suggestions.length > 0 && (
          <AutocompleteDropdown 
            suggestions={suggestions} 
            {...suggestionPos}
            onSelect={handleSuggestionSelection}
            activeIndex={activeSuggestion}
          />
        )}

        {/* Hidden measuring mirror */}
        <div
          ref={measureRef}
          className="absolute invisible pointer-events-none"
          style={{ ...textStyle, padding: 0, border: 0, left: 0, top: 0 }}
        />
      </div>
    </div>
  );
};

export default GridEditor;
