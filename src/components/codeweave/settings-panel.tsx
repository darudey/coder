
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
import type { Settings, FileSystem } from './compiler';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useState } from 'react';
import { saveApiKey } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { File, Folder, Plus, Trash2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  fileSystem: FileSystem;
  onLoadFile: (folderName: string, fileName: string) => void;
  onNewFile: () => void;
  onDeleteFile: (folderName: string, fileName: string) => void;
}

export const SettingsPanel: FC<SettingsPanelProps> = ({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  fileSystem,
  onLoadFile,
  onNewFile,
  onDeleteFile,
}) => {
  const [apiKey, setApiKey] = useState('');
  const { toast } = useToast();

  const handleSettingChange = (key: keyof Settings, value: boolean) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleSaveApiKey = async () => {
    if (!apiKey) {
      toast({
        title: 'API Key is empty',
        description: 'Please enter a valid Gemini API key.',
        variant: 'destructive',
      });
      return;
    }
    const result = await saveApiKey(apiKey);
    if (result.success) {
      toast({
        title: 'API Key Saved',
        description: 'Your Gemini API key has been saved. Please reload the page for it to take effect.',
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
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure compiler features and manage your saved code.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 py-6">
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
                    Enter your key to use AI features.
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
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
              Generate API Key
            </a>
          </div>
        </div>

        <div className="flex-grow flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Saved Code</h3>
                <Button variant="ghost" size="icon" onClick={onNewFile}>
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">New File</span>
                </Button>
            </div>
            <div className="flex-grow relative border rounded-md">
                <ScrollArea className="absolute inset-0">
                    <Accordion type="multiple" className="w-full">
                        {Object.entries(fileSystem).map(([folderName, files]) => (
                            <AccordionItem value={folderName} key={folderName}>
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <Folder className="h-4 w-4" />
                                        <span>{folderName}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="flex flex-col gap-1 pl-4">
                                        {Object.keys(files).map((fileName) => (
                                            <div key={fileName} className="flex items-center justify-between gap-2 group">
                                                <button className="flex items-center gap-2 text-left flex-grow" onClick={() => onLoadFile(folderName, fileName)}>
                                                    <File className="h-4 w-4" />
                                                    <span>{fileName}</span>
                                                </button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); onDeleteFile(folderName, fileName); }}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </ScrollArea>
            </div>
        </div>

      </SheetContent>
    </Sheet>
  );
};
