
'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Settings, Code2, Save, File } from 'lucide-react';
import type { FC } from 'react';
import type { ActiveFile } from './compiler';
import { DotLoader } from './dot-loader';

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
      <div className="flex items-center justify-between p-2 md:p-4 gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <Code2 className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-bold font-headline text-foreground">24HrCoding</h1>
        </div>
        
        <div className="flex-1 flex justify-center min-w-0">
          {activeFile && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground truncate">
                  <File className="w-4 h-4 shrink-0" />
                  <span className="truncate">{activeFile.folderName} / {activeFile.fileName}</span>
              </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={onRun} disabled={isCompiling} className="w-[88px]">
            {isCompiling ? (
              <DotLoader />
            ) : (
              <>
                <Play />
                <span className="ml-2 hidden sm:inline">Run</span>
              </>
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={onSaveAs}>
            <Save />
            <span className="sr-only">Save As</span>
          </Button>
          <Button variant="outline" size="icon" onClick={onSettings}>
            <Settings />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
      </div>
      <Separator />
    </header>
  );
};
