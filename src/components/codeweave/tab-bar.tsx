
'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { ActiveFile } from './compiler';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Label } from '../ui/label';

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
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [editingIndex]);

    const handleRename = () => {
        if (editingIndex !== null) {
            onRenameFile(editingIndex, editingName);
            setEditingIndex(null);
            setEditingName('');
        }
    };
    
    const openRenameDialog = (index: number) => {
        setEditingName(openFiles[index].fileName.replace(/\.js$/, ''));
        setEditingIndex(index);
    };

    return (
        <>
            <div className="flex items-center bg-muted/50 border-b border-border pl-2 -mt-0.5">
                <ScrollArea className="flex-grow whitespace-nowrap w-0" ref={scrollAreaRef}>
                    <div className="flex items-stretch">
                        {openFiles.map((file, index) => (
                            <div
                                key={`${file.folderName}/${file.fileName}`}
                                onClick={() => onTabClick(index)}
                                className={cn(
                                    "flex items-center gap-2 pl-3 pr-1.5 rounded-t-md text-xs border-b-2 transition-colors cursor-pointer",
                                    index === activeFileIndex
                                    ? 'bg-background text-foreground border-primary'
                                    : 'text-muted-foreground border-transparent hover:bg-muted'
                                )}
                                onDoubleClick={() => openRenameDialog(index)}
                            >
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
            
            <Dialog open={editingIndex !== null} onOpenChange={(isOpen) => !isOpen && setEditingIndex(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename File</DialogTitle>
                        <DialogDescription>
                            Enter a new name for the file. The .js extension will be added automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="file-name" className="text-right">
                                Name
                            </Label>
                            <Input
                                ref={inputRef}
                                id="file-name"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                         <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleRename}>Rename</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export const TabBar = React.memo(MemoizedTabBar);
