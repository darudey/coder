
'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import type { FC } from 'react';
import type { FileSystem } from './compiler';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { File, Folder, Plus, Trash2, Moon, Sun, Palette, KeyRound, LogIn, LogOut, Save, FolderOpen } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useSettings } from '@/hooks/use-settings';
import { Slider } from '../ui/slider';
import { useGoogleDrive } from '@/hooks/use-google-drive';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Skeleton } from '../ui/skeleton';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileSystem: FileSystem;
  onLoadFile: (folderName: string, fileName: string) => void;
  onNewFile: () => void;
  onDeleteFile: (folderName: string, fileName: string) => void;
  onOpenFileFromDrive: () => Promise<void>;
}

export const SettingsPanel: FC<SettingsPanelProps> = ({
  open,
  onOpenChange,
  fileSystem,
  onLoadFile,
  onNewFile,
  onDeleteFile,
  onOpenFileFromDrive,
}) => {
  const [apiKey, setApiKey] = useState('');
  const { toast } = useToast();
  const { settings, setSettings, toggleTheme } = useSettings();
  const { 
    isApiLoaded,
    isSignedIn,
    userProfile,
    signIn,
    signOut,
  } = useGoogleDrive();

  useEffect(() => {
    if (open) {
      const storedApiKey = localStorage.getItem('gemini-api-key');
      if (storedApiKey) {
        setApiKey(storedApiKey);
      }
    }
  }, [open]);

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
          <SheetDescription className="text-xs text-muted-foreground/80">
            Configure compiler features and manage your saved code.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-2 py-6">
          <Accordion type="single" collapsible className="w-full" defaultValue="appearance">
            <AccordionItem value="appearance">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    <span className="font-semibold text-base">Appearance</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 pt-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="font-size-slider">Font Size</Label>
                        <span className="text-sm text-muted-foreground">{settings.editorFontSize}px</span>
                    </div>
                    <Slider
                        id="font-size-slider"
                        min={10}
                        max={24}
                        step={1}
                        value={[settings.editorFontSize]}
                        onValueChange={(value) => setSettings({ ...settings, editorFontSize: value[0] })}
                    />
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="google-drive">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 448 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M330.3 36.69l-117.2 203.1L256 368.5l117.2-203.1-42.91-78.72zM448 336l-117.2 78.72L256 208l117.2 78.72L448 336zM151.2 460.3l117.2-203.1L151.2 54.09 34.03 257.2l117.2 203.1z"/>
                    </svg>
                    <span className="font-semibold text-base">Google Drive</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                 <div className="grid gap-3 pt-4">
                    {!isApiLoaded ? (
                      <Skeleton className="h-10 w-full" />
                    ) : isSignedIn && userProfile ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                           <Avatar>
                              <AvatarImage src={userProfile.imageUrl} alt={userProfile.name} />
                              <AvatarFallback>{userProfile.givenName?.[0]}</AvatarFallback>
                           </Avatar>
                           <div className='text-sm'>
                              <p className="font-semibold">{userProfile.name}</p>
                              <p className="text-muted-foreground">{userProfile.email}</p>
                           </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" className="w-full" onClick={onOpenFileFromDrive}>
                            <FolderOpen className="w-4 h-4 mr-2"/>
                            Open from Drive
                          </Button>
                          <Button variant="outline" className="w-full" onClick={signOut}>
                            <LogOut className="w-4 h-4 mr-2"/>
                            Sign Out
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button onClick={signIn}>
                        <LogIn className="w-4 h-4 mr-2"/>
                        Connect to Google Drive
                      </Button>
                    )}
                  </div>
              </AccordionContent>
            </AccordionItem>
             <AccordionItem value="api-key">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    <span className="font-semibold text-base">Gemini API Key</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                 <div className="grid gap-3 pt-4">
                    <Label htmlFor="api-key" className="flex flex-col gap-1">
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
        </SheetFooter>

      </SheetContent>
    </Sheet>
  );
};
