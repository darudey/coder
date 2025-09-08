
'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Settings, Save, File } from 'lucide-react';
import type { FC } from 'react';
import type { ActiveFile } from './compiler';
import { DotLoader } from './dot-loader';
import { LogoIcon } from './logo-icon';

interface HeaderProps {
  onRun: () => void;
  onSettings: () => void;
  isCompiling: boolean;
  onSaveAs: () => void;
  activeFile: ActiveFile | null;
}

export const Header: FC<HeaderProps> = ({ onRun, onSettings, isCompiling, onSaveAs, activeFile }) => {
  return (
    <header>
      <div className="flex items-center justify-between p-2 md:p-3 gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <LogoIcon className="w-7 h-7 md:w-8 md:h-8" />
          <h1 className="text-lg md:text-xl font-bold font-headline text-foreground">24HrCoding</h1>
        </div>
        
        <div className="flex-1 flex justify-center min-w-0 px-2">
          {activeFile && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground truncate">
                  <File className="w-4 h-4 shrink-0" />
                  <span className="truncate">{activeFile.folderName} / {activeFile.fileName}</span>
              </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
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
