
'use client';

import React from 'react';
import type { ActiveFile } from './compiler';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';

interface TabBarProps {
    openFiles: ActiveFile[];
    activeFileIndex: number;
    onTabClick: (index: number) => void;
    onTabClose: (index: number) => void;
    onNewFile: () => void;
}

const MemoizedTabBar: React.FC<TabBarProps> = ({ 
    openFiles, 
    activeFileIndex, 
    onTabClick,
    onTabClose,
    onNewFile,
}) => {
    return (
        <div className="flex items-center bg-muted/50 border-b border-border pl-2">
            <ScrollArea className="flex-grow whitespace-nowrap">
                <div className="flex items-stretch h-full">
                    {openFiles.map((file, index) => (
                        <button
                            key={`${file.folderName}/${file.fileName}`}
                            onClick={() => onTabClick(index)}
                            className={cn(
                                "flex items-center gap-2 pl-3 pr-1.5 rounded-t-md text-xs border-b-2 transition-colors py-1",
                                index === activeFileIndex
                                ? 'bg-background text-foreground border-primary'
                                : 'text-muted-foreground border-transparent hover:bg-muted'
                            )}
                        >
                            <span className="truncate max-w-40">{file.fileName}</span>
                            <div 
                                className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTabClose(index);
                                }}
                            >
                                <X className="w-3 h-3" />
                            </div>
                        </button>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <div className="p-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewFile}>
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

export const TabBar = React.memo(MemoizedTabBar);
