
'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Settings, Save, File } from 'lucide-react';
import type { FC } from 'react';
import type { ActiveFile } from './compiler';
import { DotLoader } from './dot-loader';
import { LogoIcon } from './logo-icon';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onRun: () => void;
  onSettings: () => void;
  isCompiling: boolean;
  onSaveAs: () => void;
  activeFile: ActiveFile | null;
}

export const Header: FC<HeaderProps> = ({ onRun, onSettings, isCompiling, onSaveAs, activeFile }) => {
  return (
    <header className="bg-background">
      <div className="flex items-end p-2 md:px-3 gap-2">
        <div className={cn(
          "flex items-center gap-2 shrink-0",
          "bg-card text-card-foreground rounded-t-md px-3 pt-2 pb-1.5 border-b-2 border-primary"
        )}>
          <LogoIcon className="w-6 h-6" />
          <h1 className="text-base font-bold font-headline text-foreground">24HrCoding</h1>
        </div>
        
        <div className="flex-1 flex justify-center min-w-0 pb-1">
          {activeFile && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground truncate">
                  <File className="w-4 h-4 shrink-0" />
                  <span className="truncate">{activeFile.folderName} / {activeFile.fileName}</span>
              </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0 pb-1">
          <Button onClick={onRun} disabled={isCompiling} className="min-w-[70px] md:min-w-[88px]">
            {isCompiling ? (
              <DotLoader />
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span className="ml-1.5 hidden sm:inline">Run</span>
              </>
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={onSaveAs}>
            <Save className="w-4 h-4" />
            <span className="sr-only">Save As</span>
          </Button>
          <Button variant="outline" size="icon" onClick={onSettings}>
            <Settings className="w-4 h-4" />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
      </div>
      <Separator />
    </header>
  );
};
