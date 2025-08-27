
'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { FC } from 'react';
import type { Settings } from './compiler';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onSettingsChange: (settings: Omit<Settings, 'coderKeyboard'>) => void;
}

export const SettingsPanel: FC<SettingsPanelProps> = ({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}) => {
  const handleSettingChange = (key: keyof Omit<Settings, 'coderKeyboard'>, value: boolean) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure the compiler features to your liking. Changes are saved automatically.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 py-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="syntax-highlighting" className="flex flex-col gap-1">
              <span>AI Syntax Highlighting</span>
              <span className="font-normal text-sm text-muted-foreground">
                Show code with colors for better readability.
              </span>
            </Label>
            <Switch
              id="syntax-highlighting"
              checked={settings.syntaxHighlighting}
              onCheckedChange={(value) => handleSettingChange('syntaxHighlighting', value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="error-checking" className="flex flex-col gap-1">
              <span>AI Error Checking</span>
               <span className="font-normal text-sm text-muted-foreground">
                Use static analysis to find potential bugs.
              </span>
            </Label>
            <Switch
              id="error-checking"
              checked={settings.errorChecking}
              onCheckedChange={(value) => handleSettingChange('errorChecking', value)}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
