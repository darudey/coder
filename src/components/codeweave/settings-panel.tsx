
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
import React, { FC, useRef } from 'react';
import type { FileSystem } from '@/hooks/use-compiler-fs';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { File, Folder, Plus, Trash2, Moon, Sun, Palette, KeyRound, LogIn, LogOut, Save, FolderOpen, Upload } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useSettings } from '@/hooks/use-settings';
import { Slider } from '../ui/slider';
import { useGoogleDrive } from '@/hooks/use-google-drive';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { useIsMobile } from '@/hooks/use-mobile';
import { buttonVariants } from '../ui/button';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileSystem: FileSystem;
  onLoadFile: (folderName: string, fileName: string) => void;
  onNewFile: () => void;
  onDeleteFile: (folderName: string, fileName: string) => void;
  onOpenFileFromDrive: () => void;
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
  const { settings, setSettings, theme, setTheme } = useSettings();
  const isMobile = useIsMobile();
  const { 
    isApiLoaded,
    isSignedIn,
    userProfile,
    signIn,
    signOut,
  } = useGoogleDrive();
  const fileInputRef = useRef<HTMLInputElement>(null);


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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/javascript' && !file.name.endsWith('.js')) {
        toast({
            title: 'Invalid File Type',
            description: 'Please upload a JavaScript (.js) file.',
            variant: 'destructive',
        });
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result as string;
        // Use the addFile function which is now passed down or accessible
        // For now, we assume a function like this exists.
        // This part needs to be connected to the new `addFile` in useCompilerFs
        onLoadFile('Uploaded Files', file.name); // This might need adjustment
        toast({
            title: 'File Uploaded',
            description: `${file.name} has been added to your files.`,
        });
        // Reset file input so the same file can be uploaded again
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    reader.onerror = () => {
        toast({
            title: 'Error Reading File',
            description: 'Could not read the selected file.',
            variant: 'destructive',
        });
    };
    reader.readAsText(file);
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <div className="flex justify-between items-center">
            <SheetTitle>Settings</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground/80">
            Configure compiler features and manage your saved code.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-grow -mx-6">
            <div className="px-6 space-y-4">
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
                        <div>
                            <Label htmlFor="font-size-slider">Font Size ({settings.editorFontSize}px)</Label>
                            <Slider
                            id="font-size-slider"
                            min={10}
                            max={24}
                            step={1}
                            value={[settings.editorFontSize]}
                            onValueChange={(value) => setSettings({ ...settings, editorFontSize: value[0] })}
                            className="mt-2"
                            />
                        </div>
                        <div>
                            <Label>Theme</Label>
                            <div className="flex gap-2 mt-2">
                                <Button variant={theme === 'light' ? 'secondary' : 'outline'} size="sm" onClick={() => setTheme('light')}>
                                    <Sun className="w-4 h-4 mr-2" /> Light
                                </Button>
                                <Button variant={theme === 'dark' ? 'secondary' : 'outline'} size="sm" onClick={() => setTheme('dark')}>
                                    <Moon className="w-4 h-4 mr-2" /> Dark
                                </Button>
                                <Button variant={theme === 'system' ? 'secondary' : 'outline'} size="sm" onClick={() => setTheme('system')}>
                                    System
                                </Button>
                            </div>
                        </div>
                         <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                                <Label htmlFor="session-output-toggle">Floating Session Output</Label>
                                <p className="text-xs text-muted-foreground">
                                    Show session output in a floating panel.
                                </p>
                            </div>
                            <Switch
                                id="session-output-toggle"
                                checked={settings.isSessionOutputFloating}
                                onCheckedChange={(checked) => setSettings({...settings, isSessionOutputFloating: checked})}
                            />
                        </div>
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

                <div className="flex-grow flex flex-col min-h-0 pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">Saved Code</h3>
                        <div className="flex items-center">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange}
                                accept=".js,application/javascript"
                                className="hidden" 
                            />
                            <Button variant="ghost" size="icon" onClick={handleUploadClick}>
                                <Upload className="h-4 w-4" />
                                <span className="sr-only">Upload File</span>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={onNewFile}>
                                <Plus className="h-4 w-4" />
                                <span className="sr-only">New File</span>
                            </Button>
                        </div>
                    </div>
                    <div className="flex-grow border rounded-md min-h-[200px]">
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
            </div>
        </ScrollArea>
        <SheetFooter className="mt-auto pt-4 border-t">
            {/* Footer content can go here if needed */}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
