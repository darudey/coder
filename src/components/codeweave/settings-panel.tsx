
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
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useState } from 'react';
import { saveApiKey } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

export const SettingsPanel: FC<SettingsPanelProps> = ({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}) => {
  const [apiKey, setApiKey] = useState('');
  const { toast } = useToast();

  const handleSettingChange = (key: keyof Settings, value: boolean) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleSaveApiKey = async () => {
    const result = await saveApiKey(apiKey);
    if (result.success) {
      toast({
        title: 'API Key Saved',
        description: 'Your Gemini API key has been saved successfully. Please reload the page for it to take effect.',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
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
              <span>Syntax Highlighting</span>
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
           <div className="grid gap-3">
            <Label htmlFor="api-key" className="flex flex-col gap-1">
                <span>Gemini API Key</span>
                <span className="font-normal text-sm text-muted-foreground">
                    Enter your Gemini API key to use AI features.
                </span>
            </Label>
            <div className="flex gap-2">
                <Input
                    id="api-key"
                    type="password"
                    placeholder="Your Gemini API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
                <Button onClick={handleSaveApiKey}>Save</Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
