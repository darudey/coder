
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Bold, Italic, List, Underline, ChevronDown, ListOrdered } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { CoderKeyboard } from '@/components/codeweave/coder-keyboard';
import { cn } from '@/lib/utils';

export interface RichTextEditorRef {
  getValue: () => string;
}

const RichTextEditor = React.forwardRef<RichTextEditorRef, { initialValue: string; onContentChange: (newContent: string) => void }>(({ initialValue, onContentChange }, ref) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const [activeStyles, setActiveStyles] = React.useState<string[]>([]);
    const [currentBlockType, setCurrentBlockType] = React.useState('Paragraph');
    const isMobile = useIsMobile();
    const [isKeyboardVisible, setIsKeyboardVisible] = React.useState(false);
    const [ctrlActive, setCtrlActive] = React.useState(false);
    
    React.useImperativeHandle(ref, () => ({
        getValue: () => editorRef.current?.innerHTML || '',
    }));

    React.useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== initialValue) {
            editorRef.current.innerHTML = initialValue;
        }
    }, [initialValue]);
    
    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        onContentChange(e.currentTarget.innerHTML);
        updateActiveStyles();
    };

    const execCommand = (command: string, value?: string) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
        updateActiveStyles();
        onContentChange(editorRef.current?.innerHTML || '');
    };

    const toggleList = (command: 'insertUnorderedList' | 'insertOrderedList') => {
        const editor = editorRef.current;
        if (!editor) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            execCommand(command);
            return;
        }

        let container = selection.getRangeAt(0).startContainer;

        // Find if we are inside a list already
        let listNode: Node | null = container;
        while (listNode && listNode.parentElement !== editor && listNode.nodeName !== 'UL' && listNode.nodeName !== 'OL') {
            listNode = listNode.parentElement;
        }
        
        const isInList = listNode && (listNode.nodeName === 'UL' || listNode.nodeName === 'OL');
        
        if (isInList) {
             const newPara = document.createElement('p');
             newPara.innerHTML = '&#8203;'; // Zero-width space
             
             let topList: Node = listNode;
             while(topList.parentElement && topList.parentElement !== editor && (topList.parentElement.nodeName === 'UL' || topList.parentElement.nodeName === 'OL' || topList.parentElement.nodeName === 'LI')) {
                 topList = topList.parentElement;
             }
 
             (topList as HTMLElement).after(newPara);
     
             const newRange = document.createRange();
             newRange.setStart(newPara, 0);
             newRange.collapse(true);
             selection.removeAllRanges();
             selection.addRange(newRange);
        } else {
            execCommand(command);
        }
        
        editor.focus();
        updateActiveStyles();
        onContentChange(editor.innerHTML);
    }


    const undo = () => {
        document.execCommand('undo');
    }

    const redo = () => {
        document.execCommand('redo');
    }

    const cycleHeadline = () => {
        const currentBlock = currentBlockType.toLowerCase();
        let nextBlock = 'p'; // Default to paragraph
        if (currentBlock === 'paragraph') nextBlock = 'h1';
        else if (currentBlock === 'headline 1') nextBlock = 'h2';
        else if (currentBlock === 'headline 2') nextBlock = 'h3';
        else if (currentBlock === 'headline 3') nextBlock = 'h4';
        else if (currentBlock === 'headline 4') nextBlock = 'p';

        execCommand('formatBlock', nextBlock);
    }

    const updateActiveStyles = () => {
        if (!editorRef.current) return;
        const styles: string[] = [];
        if (document.queryCommandState('bold')) styles.push('bold');
        if (document.queryCommandState('italic')) styles.push('italic');
        if (document.queryCommandState('underline')) styles.push('underline');
        if (document.queryCommandState('insertUnorderedList')) styles.push('ul');
        if (document.queryCommandState('insertOrderedList')) styles.push('ol');
        
        const blockType = document.queryCommandValue('formatBlock');
        if (blockType.startsWith('h')) {
            styles.push(blockType);
            setCurrentBlockType(`Headline ${blockType.charAt(1)}`);
        } else {
            setCurrentBlockType('Paragraph');
        }

        setActiveStyles(styles);
    };
    
    const handleSelectionChange = React.useCallback(() => {
        if (editorRef.current && document.getSelection()?.containsNode(editorRef.current, true)) {
            updateActiveStyles();
        }
    }, []);

    React.useEffect(() => {
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [handleSelectionChange]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Backspace') {
            const selection = window.getSelection();
            if (selection && selection.isCollapsed && selection.anchorOffset === 0) {
                let node = selection.anchorNode;
                if (node && node.nodeType === Node.TEXT_NODE && node.parentElement?.tagName === 'LI') {
                    node = node.parentElement;
                }
                if (node && node.nodeName === 'LI' && (node as HTMLElement).textContent?.length === 0) {
                     e.preventDefault();
                    document.execCommand('formatBlock', false, 'p');
                    return;
                }
            }
        }
        
        if (e.ctrlKey || e.metaKey) {
            switch(e.key.toLowerCase()) {
                case 'b': e.preventDefault(); execCommand('bold'); break;
                case 'i': e.preventDefault(); execCommand('italic'); break;
                case 'u': e.preventDefault(); execCommand('underline'); break;
                case 'l': e.preventDefault(); toggleList('insertUnorderedList'); break;
                case 'h': e.preventDefault(); cycleHeadline(); break;
                case 'z': e.preventDefault(); undo(); break;
                case 'y': e.preventDefault(); redo(); break;
                case 'a': e.preventDefault(); document.execCommand('selectAll'); break;
            }
            if (e.shiftKey && e.key === '7') {
                e.preventDefault();
                toggleList('insertOrderedList');
            }
        }
    }
    
    const handleKeyPress = (key: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        editor.focus();

        if (key === 'Enter') {
            document.execCommand('insertParagraph', false);
            return;
        }

        if (key === 'Ctrl') {
            setCtrlActive(prev => !prev);
            return;
        }

        if (ctrlActive) {
            setCtrlActive(false);
            switch(key.toLowerCase()) {
                case 'b': execCommand('bold'); break;
                case 'i': execCommand('italic'); break;
                case 'u': execCommand('underline'); break;
                case 'l': toggleList('insertUnorderedList'); break;
                case 'h': cycleHeadline(); break;
                case 'z': undo(); break;
                case 'y': redo(); break;
                case 'a': document.execCommand('selectAll'); break;
                default:
                    document.execCommand('insertText', false, key);
            }
            return;
        }
        
        if (key === 'Backspace') {
            const selection = window.getSelection();
            if (selection && selection.isCollapsed && selection.anchorOffset === 0) {
                let node = selection.anchorNode;
                if (node && node.nodeType === Node.TEXT_NODE && node.parentElement?.tagName === 'LI') {
                    node = node.parentElement;
                }
                if (node && node.nodeName === 'LI' && (node as HTMLElement).textContent?.length === 0) {
                    document.execCommand('formatBlock', false, 'p');
                    return;
                }
            }
            document.execCommand('delete');
        } else if (key.length === 1) {
            document.execCommand('insertText', false, key);
        }
    }

    const showKeyboard = isMobile && isKeyboardVisible;

    return (
        <>
            <div className="border rounded-md">
                <div className="flex items-center gap-1 p-1 border-b bg-muted/50 flex-wrap">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 px-2 text-xs">
                                {currentBlockType}
                                <ChevronDown className="w-4 h-4 ml-1" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => execCommand('formatBlock', 'p')}>Paragraph</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => execCommand('formatBlock', 'h1')}>Headline 1</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => execCommand('formatBlock', 'h2')}>Headline 2</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => execCommand('formatBlock', 'h3')}>Headline 3</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => execCommand('formatBlock', 'h4')}>Headline 4</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="toggle" size="icon" className="h-8 w-8" onClick={() => execCommand('bold')} data-state={activeStyles.includes('bold') ? 'on' : 'off'}>
                        <Bold className="w-4 h-4" />
                    </Button>
                    <Button variant="toggle" size="icon" className="h-8 w-8" onClick={() => execCommand('italic')} data-state={activeStyles.includes('italic') ? 'on' : 'off'}>
                        <Italic className="w-4 h-4" />
                    </Button>
                    <Button variant="toggle" size="icon" className="h-8 w-8" onClick={() => execCommand('underline')} data-state={activeStyles.includes('underline') ? 'on' : 'off'}>
                        <Underline className="w-4 h-4" />
                    </Button>
                    <Button variant="toggle" size="icon" className="h-8 w-8" onClick={() => toggleList('insertUnorderedList')} data-state={activeStyles.includes('ul') ? 'on' : 'off'}>
                        <List className="w-4 h-4" />
                    </Button>
                    <Button variant="toggle" size="icon" className="h-8 w-8" onClick={() => toggleList('insertOrderedList')} data-state={activeStyles.includes('ol') ? 'on' : 'off'}>
                        <ListOrdered className="w-4 h-4" />
                    </Button>
                </div>
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if(isMobile) setIsKeyboardVisible(true) }}
                    onClick={() => { if(isMobile) setIsKeyboardVisible(true) }}
                    onSelect={updateActiveStyles}
                    inputMode={isMobile ? 'none' : 'text'}
                    className="min-h-[120px] w-full p-4 prose dark:prose-invert max-w-none focus:outline-none"
                />
            </div>
             {showKeyboard && (
                <div id="coder-keyboard" className={cn(
                    "fixed bottom-0 left-0 right-0 transition-transform duration-300 ease-in-out z-[999]",
                    isKeyboardVisible ? "translate-y-0" : "translate-y-full"
                )}>
                    <CoderKeyboard 
                        onKeyPress={handleKeyPress}
                        ctrlActive={ctrlActive}
                        onHide={() => setIsKeyboardVisible(false)}
                        isSuggestionsOpen={false}
                        onNavigateSuggestions={() => {}}
                        onSelectSuggestion={() => {}}
                    />
                </div>
             )}
        </>
    );
});
RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;
