
'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Settings, Loader2, Code2, Save, File } from 'lucide-react';
import type { FC } from 'react';
import type { ActiveFile } from './compiler';

interface HeaderProps {
  onRun: () => void;
  onSettings: () => void;
  isCompiling: boolean;
  onSave: () => void;
  activeFile: ActiveFile | null;
}

export const Header: FC<HeaderProps> = ({ onRun, onSettings, isCompiling, onSave, activeFile }) => {
  return (
    <header>
      <div className="flex items-center justify-between p-2 md:p-4">
        <div className="flex items-center gap-3">
          <Code2 className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-bold font-headline text-foreground">24HrCoding</h1>
        </div>
        {activeFile && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <File className="w-4 h-4" />
                <span>{activeFile.folderName} / {activeFile.fileName}</span>
            </div>
        )}
        <div className="flex items-center gap-2">
          <Button onClick={onRun} disabled={isCompiling}>
            {isCompiling ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Play />
            )}
            <span className="ml-2 hidden sm:inline">Run</span>
          </Button>
          <Button variant="outline" size="icon" onClick={onSave}>
            <Save />
            <span className="sr-only">Save</span>
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
