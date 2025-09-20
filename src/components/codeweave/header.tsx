
'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Settings, Save, File, Share2 } from 'lucide-react';
import React from 'react';
import type { ActiveFile } from './compiler';
import { DotLoader } from './dot-loader';
import { LogoIcon } from './logo-icon';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onRun: () => void;
  onSettings: () => void;
  isCompiling: boolean;
  onSaveAs: () => void;
  onShare: () => void;
  activeFile: ActiveFile | null;
  hasActiveFile: boolean;
}

const MemoizedHeader: React.FC<HeaderProps> = ({ onRun, onSettings, isCompiling, onSaveAs, onShare, activeFile, hasActiveFile }) => {
  return (
    <header className="bg-background">
      <div className={cn(
        "flex items-center justify-between p-2 md:px-3 gap-2",
      )}>
        <div className="flex items-center gap-2 shrink-0">
          <LogoIcon className="w-6 h-6" />
          <h1 className="text-base font-bold font-headline text-gray-900 dark:text-gray-100">24HrCoding</h1>
        </div>
        
        <div className="flex-1 flex justify-center min-w-0 px-2">
          {activeFile && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground truncate bg-muted px-3 py-1.5 rounded-md">
                  <File className="w-4 h-4 shrink-0" />
                  <span className="truncate">{activeFile.folderName} / {activeFile.fileName}</span>
              </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <Button onClick={onRun} disabled={isCompiling || !hasActiveFile} className="min-w-[70px] md:min-w-[88px]">
            {isCompiling ? (
              <DotLoader />
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span className="ml-1.5 hidden sm:inline">Run</span>
              </>
            )}
          </Button>
          <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={onShare} disabled={!hasActiveFile}>
                <Share2 className="w-4 h-4" />
                <span className="sr-only">Share</span>
              </Button>
              <Button variant="outline" size="icon" onClick={onSaveAs} disabled={!hasActiveFile}>
                <Save className="w-4 h-4" />
                <span className="sr-only">Save As</span>
              </Button>
              <Button variant="outline" size="icon" onClick={onSettings}>
                <Settings className="w-4 h-4" />
                <span className="sr-only">Settings</span>
              </Button>
          </div>
        </div>
      </div>
      <Separator />
    </header>
  );
};

export const Header = React.memo(MemoizedHeader);

    




