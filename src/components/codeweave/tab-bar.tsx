
'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { ActiveFile } from './compiler';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface TabBarProps {
    openFiles: ActiveFile[];
    activeFileIndex: number;
    onTabClick: (index: number) => void;
    onTabClose: (index: number) => void;
    onNewFile: () => void;
    onRenameFile: (index: number, newName: string) => void;
}

const MemoizedTabBar: React.FC<TabBarProps> = ({ 
    openFiles, 
    activeFileIndex, 
    onTabClick,
    onTabClose,
    onNewFile,
    onRenameFile,
}) => {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const activeTabRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scrollArea = scrollAreaRef.current;
        if (!scrollArea) return;

        const handleWheel = (e: WheelEvent) => {
            const viewport = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport && viewport.scrollWidth > viewport.clientWidth) {
                e.preventDefault();
                viewport.scrollLeft += e.deltaY;
            }
        };

        scrollArea.addEventListener('wheel', handleWheel);

        return () => {
            scrollArea.removeEventListener('wheel', handleWheel);
        };
    }, []);

    useEffect(() => {
        if (editingIndex !== null) {
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 100);
        }
    }, [editingIndex]);

    useEffect(() => {
        if (activeTabRef.current) {
            activeTabRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }, [activeFileIndex]);


    const handleRename = () => {
        if (editingIndex !== null) {
            onRenameFile(editingIndex, editingName);
            setEditingIndex(null);
            setEditingName('');
        }
    };
    
    const handleStartEditing = (index: number) => {
        setEditingIndex(index);
        setEditingName(openFiles[index].fileName);
    };

    return (
        <div className="flex items-center bg-muted/50 border-b border-border pl-2 -mt-0.5">
            <ScrollArea className="flex-grow whitespace-nowrap w-0" ref={scrollAreaRef}>
                <div className="flex items-stretch">
                    {openFiles.map((file, index) => (
                        <div
                            key={`${file.folderName}/${file.fileName}`}
                            ref={index === activeFileIndex ? activeTabRef : null}
                            onClick={() => onTabClick(index)}
                            onDoubleClick={() => handleStartEditing(index)}
                            className={cn(
                                "flex items-center gap-2 pl-3 pr-1.5 rounded-t-md text-xs border-b-2 transition-colors cursor-pointer relative",
                                index === activeFileIndex
                                ? 'bg-background text-foreground border-primary'
                                : 'text-muted-foreground border-transparent hover:bg-muted',
                                editingIndex === index && "min-w-[150px] z-10" // Give space for editing
                            )}
                        >
                            {editingIndex === index ? (
                                <Input
                                    ref={inputRef}
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onBlur={handleRename}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRename();
                                        if (e.key === 'Escape') setEditingIndex(null);
                                    }}
                                    className="h-6 text-xs px-1 w-full"
                                />
                            ) : (
                                <>
                                    <span className="truncate max-w-40 py-1.5">{file.fileName}</span>
                                    <div 
                                        className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTabClose(index);
                                        }}
                                    >
                                        <X className="w-3 h-3" />
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <div className="p-1">
                <TooltipProvider delayDuration={200}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewFile}>
                                <Plus className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Alt + N</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}

export const TabBar = React.memo(MemoizedTabBar);
