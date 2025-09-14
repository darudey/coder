
'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { FC } from 'react';
import type { Settings, FileSystem } from './compiler';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { File, Folder, Plus, Trash2, Moon, Sun, Info } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { AboutContent } from './about-content';

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
  const [theme, setTheme] = useState('light');
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = storedTheme || systemTheme;
    setTheme(initialTheme);
  }, []);
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };
  
  useEffect(() => {
    if (open) {
      const storedApiKey = localStorage.getItem('gemini-api-key');
      if (storedApiKey) {
        setApiKey(storedApiKey);
      }
    }
  }, [open]);

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
    localStorage.setItem('gemini-api-key', apiKey);
    toast({
        title: 'API Key Saved',
        description: 'Your Gemini API key has been saved in your browser.',
    });
  };


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <div className="flex justify-between items-center">
            <SheetTitle>Settings</SheetTitle>
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
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
                    Enter your key to use AI features. It will be saved in your browser.
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
            <div className="flex-grow border rounded-md min-h-0">
                <ScrollArea className="h-full">
                    <Accordion type="multiple" className="w-full">
                        {Object.entries(fileSystem).map(([folderName, files]) => (
                            <AccordionItem value={folderName} key={folderName} className="border-b-0">
                                <AccordionTrigger className="px-2 py-2 text-sm hover:no-underline">
                                    <div className="flex items-center gap-1.5">
                                        <Folder className="h-3.5 w-3.5" />
                                        <span className="font-medium">{folderName}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-0">
                                    <div className="flex flex-col gap-px pl-4">
                                        {Object.keys(files).map((fileName) => (
                                            <div key={fileName} className="flex items-center justify-between gap-1 group pr-2">
                                                <button className="flex items-center gap-1.5 text-left flex-grow p-1 rounded-sm hover:bg-muted" onClick={() => onLoadFile(folderName, fileName)}>
                                                    <File className="h-3.5 w-3.5" />
                                                    <span className="text-xs">{fileName}</span>
                                                </button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); onDeleteFile(folderName, fileName); }}>
                                                    <Trash2 className="h-3.5 w-3.5" />
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

        <SheetFooter className="mt-4">
            <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                    <Info className="mr-2 h-4 w-4" />
                    About 24HrCoding
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl h-4/5 flex flex-col">
                <DialogHeader>
                  <DialogTitle>About 24HrCoding</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-grow pr-6 -mr-6">
                    <AboutContent />
                </ScrollArea>
              </DialogContent>
            </Dialog>
        </SheetFooter>

      </SheetContent>
    </Sheet>
  );
};
