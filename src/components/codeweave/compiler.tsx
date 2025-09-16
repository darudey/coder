
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { checkCodeForErrors, shareCode, type RunResult } from '@/app/actions';
import { CodeEditor } from './code-editor';
import { Header } from './header';
import { SettingsPanel } from './settings-panel';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OutputDisplay } from './output-display';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { TabBar } from './tab-bar';
import { Switch } from '../ui/switch';
import { Copy } from 'lucide-react';
import { DotLoader } from './dot-loader';

const defaultCode = `// Welcome to 24HrCoding!
// Use the settings panel to save and load your creations.
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
`;

export interface Settings {
  errorChecking: boolean;
}

export type FileSystem = {
  [folderName: string]: {
    [fileName: string]: string;
  };
};

export interface ActiveFile {
    folderName: string;
    fileName: string;
}

const getInitialFileSystem = (): FileSystem => {
    if (typeof window === 'undefined') {
        return { 'Examples': { 'Welcome.js': defaultCode } };
    }
    const saved = localStorage.getItem('codeFileSystem');
    if (saved) {
        try {
            const fs = JSON.parse(saved);
            // Ensure fs is an object and not empty
            if (fs && typeof fs === 'object' && Object.keys(fs).length > 0) {
                return fs;
            }
        } catch (e) {
            // Fallback if parsing fails
        }
    }
    return { 'Examples': { 'Welcome.js': defaultCode } };
}

const runCodeOnClient = (code: string): Promise<RunResult> => {
    return new Promise((resolve) => {
        const worker = new Worker('/runner.js');
        const timeout = setTimeout(() => {
            worker.terminate();
            resolve({
                output: 'Execution timed out. Your code may have an infinite loop.',
                type: 'error',
            });
        }, 5000); // 5-second timeout

        worker.onmessage = (e) => {
            clearTimeout(timeout);
            worker.terminate();
            resolve(e.data);
        };

        worker.onerror = (e) => {
            clearTimeout(timeout);
            worker.terminate();
            resolve({
                output: `Worker error: ${e.message}`,
                type: 'error',
            });
        };

        worker.postMessage({ code });
    });
};


export function Compiler() {
  const [fileSystem, setFileSystem] = useState<FileSystem>({});
  const [openFiles, setOpenFiles] = useState<ActiveFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);
  const activeFile = activeFileIndex !== -1 ? openFiles[activeFileIndex] : null;

  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  
  const createNewFile = useCallback((activate = true) => {
    let nextFileNumber = 0;
    const prefix = "24hrcoding";
    const extension = ".js";

    // Find the highest existing number
    for (const folderName in fileSystem) {
        for (const fileName in fileSystem[folderName]) {
            if (fileName.startsWith(prefix) && fileName.endsWith(extension)) {
                const numberPart = fileName.substring(prefix.length, fileName.length - extension.length);
                if (/^\d+$/.test(numberPart)) {
                    const number = parseInt(numberPart, 10);
                    if (number >= nextFileNumber) {
                        nextFileNumber = number + 1;
                    }
                }
            }
        }
    }

    const newFileName = `${prefix}${nextFileNumber}${extension}`;
    const newFile = { folderName: 'New Files', fileName: newFileName };

    setFileSystem(fs => {
        const newFs = { ...fs };
        if (!newFs[newFile.folderName]) {
            newFs[newFile.folderName] = {};
        }
        newFs[newFile.folderName][newFile.fileName] = defaultCode;
        localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
        return newFs;
    });

    if (activate) {
        setOpenFiles(of => {
            const newOpenFiles = [...of, newFile];
            setActiveFileIndex(newOpenFiles.length - 1);
            return newOpenFiles;
        });
    }
    setIsSettingsOpen(false);
  }, [fileSystem]);

  const closeTab = useCallback((indexToClose: number) => {
    setOpenFiles(of => of.filter((_, i) => i !== indexToClose));
    
    if (openFiles.length === 1) { // We are closing the last tab
        setActiveFileIndex(-1);
        return;
    }

    if (indexToClose < activeFileIndex) {
        setActiveFileIndex(i => i - 1);
    } else if (indexToClose === activeFileIndex) {
        if (indexToClose >= openFiles.length - 1) { // if it's the last tab
            setActiveFileIndex(i => i - 1);
        }
        // otherwise, the next tab will shift into the current index, so no change needed
    }
  }, [activeFileIndex, openFiles.length]);

  const deleteFile = useCallback((folderName: string, fileName: string) => {
    setFileSystem(fs => {
        const newFs = { ...fs };
        if (newFs[folderName]) {
            delete newFs[folderName][fileName];
            if (Object.keys(newFs[folderName]).length === 0) {
                delete newFs[folderName];
            }
        }
        localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
        return newFs;
    });

    const fileIndexToRemove = openFiles.findIndex(f => f.fileName === fileName && f.folderName === folderName);
    
    if (fileIndexToRemove !== -1) {
        closeTab(fileIndexToRemove);
    }
    
  }, [openFiles, closeTab]);

  useEffect(() => {
    setIsMounted(true);
    const fs = getInitialFileSystem();
    setFileSystem(fs);

    let initialOpenFiles: ActiveFile[] = [];
    const savedOpenFiles = localStorage.getItem('openFiles');
    if (savedOpenFiles) {
        try {
            const parsed = JSON.parse(savedOpenFiles);
            if (Array.isArray(parsed)) {
                // Filter out files that no longer exist
                initialOpenFiles = parsed.filter(f => fs[f.folderName]?.[f.fileName] !== undefined);
            }
        } catch (e) {
            // ignore
        }
    }

    if (initialOpenFiles.length === 0) {
        // Fallback to the first file in the filesystem
        const fallbackFolder = Object.keys(fs)[0];
        if (fallbackFolder && fs[fallbackFolder]) {
            const fallbackFile = Object.keys(fs[fallbackFolder])[0];
            if (fallbackFile) {
                initialOpenFiles = [{ folderName: fallbackFolder, fileName: fallbackFile }];
            } else {
                createNewFile(true);
            }
        } else {
             createNewFile(true);
        }
    }
    
    if (initialOpenFiles.length > 0) {
        setOpenFiles(initialOpenFiles);
        let initialActiveIndex = -1;
        const savedActiveIndex = localStorage.getItem('activeFileIndex');
        if (savedActiveIndex) {
            try {
                const parsedIndex = parseInt(savedActiveIndex, 10);
                if (parsedIndex >= 0 && parsedIndex < initialOpenFiles.length) {
                    initialActiveIndex = parsedIndex;
                }
            } catch (e) {
                // ignore
            }
        }

        if (initialActiveIndex === -1) {
            initialActiveIndex = 0;
        }
        
        setActiveFileIndex(initialActiveIndex);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCodeFromState = useCallback(() => {
    if (activeFile && fileSystem[activeFile.folderName]?.[activeFile.fileName] !== undefined) {
        return fileSystem[activeFile.folderName][activeFile.fileName];
    }
    return '';
  }, [activeFile, fileSystem]);

  const [history, setHistory] = useState<string[]>([getCodeFromState()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const code = history[historyIndex];
  const debouncedCode = useDebounce(code, 500);
  
  const [isCompiling, setIsCompiling] = useState(false);
  const [isAiChecking, setIsAiChecking] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({ errorChecking: false });
  const [output, setOutput] = useState<RunResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ fileName: '', folderName: '' });

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const setCode = useCallback((newCode: string, fromHistory = false) => {
    if (!fromHistory) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newCode);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  }, [historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(newHistory => newHistory + 1);
    }
  }, [historyIndex, history.length]);
  
  useEffect(() => {
    if (debouncedCode && activeFile && isMounted) {
        if (fileSystem[activeFile.folderName]?.[activeFile.fileName] !== debouncedCode) {
            setFileSystem(fs => {
                const newFs = { ...fs };
                if (!newFs[activeFile.folderName]) {
                    newFs[activeFile.folderName] = {};
                }
                newFs[activeFile.folderName][activeFile.fileName] = debouncedCode;
                localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
                return newFs;
            });
        }
    }
  }, [debouncedCode, activeFile, isMounted, fileSystem]);
  
  useEffect(() => {
    if (!isMounted) return;
    const codeToSet = getCodeFromState();
    if(codeToSet !== code) {
      setHistory([codeToSet]);
      setHistoryIndex(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileIndex, openFiles, fileSystem, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    if (openFiles.length > 0) {
        localStorage.setItem('openFiles', JSON.stringify(openFiles));
    } else {
        localStorage.removeItem('openFiles');
    }
    if (activeFileIndex !== -1) {
        localStorage.setItem('activeFileIndex', String(activeFileIndex));
    } else {
        localStorage.removeItem('activeFileIndex');
    }
  }, [openFiles, activeFileIndex, isMounted]);

  const handleRun = useCallback(async () => {
    setIsCompiling(true);
    setIsResultOpen(true);
    setOutput(null); // Clear previous output
    let result: RunResult | null = null;
    
    if (settings.errorChecking) {
      setIsAiChecking(true);
      // This will be replaced by error explanation logic
      result = await runCodeOnClient(code);
      if (result.type === 'error') {
        // Here we'd call the new AI action
      }
      setIsAiChecking(false);
    }

    if (!result) {
        result = await runCodeOnClient(code);
    }
    setOutput(result);
    setIsCompiling(false);
  }, [code, settings.errorChecking]);

  const handleSaveRequest = useCallback(() => {
    if (!activeFile) return;
    setSaveForm({ 
        fileName: activeFile.fileName, 
        folderName: activeFile.folderName
    });
    setIsSaveOpen(true);
  }, [activeFile]);

  const handleShare = useCallback(async () => {
    if (!activeFile) return;
    const codeToShare = fileSystem[activeFile.folderName][activeFile.fileName];
    if (!codeToShare) return;
    
    setIsSharing(true);
    setShareDialogOpen(true);
    const result = await shareCode(codeToShare);
    if ('id' in result) {
        const url = `${window.location.origin}/s/${result.id}`;
        setShareLink(url);
    } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        setShareLink('');
    }
    setIsSharing(false);
  }, [activeFile, fileSystem, toast]);

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast({ title: 'Copied!', description: 'Share link copied to clipboard.' });
  };

  const handleSave = useCallback(() => {
    if (!activeFile) return;
    
    const { fileName, folderName } = saveForm;
    let trimmedFileName = fileName.trim();
    const trimmedFolderName = folderName.trim();

    if (!trimmedFileName || !trimmedFolderName) {
        toast({ title: 'Error', description: 'File and folder names cannot be empty.', variant: 'destructive' });
        return;
    }
    
    if (!trimmedFileName.endsWith('.js')) {
        trimmedFileName += '.js';
    }

    const newActiveFile = { fileName: trimmedFileName, folderName: trimmedFolderName };
    const isNewFileOrRename = activeFile.fileName !== newActiveFile.fileName || activeFile.folderName !== newActiveFile.folderName;

    setFileSystem(fs => {
        const newFs = { ...fs };
        
        if (isNewFileOrRename) {
            if (newFs[newActiveFile.folderName]?.[newActiveFile.fileName]) {
                 toast({ title: 'Error', description: 'A file with that name already exists in the destination folder.', variant: 'destructive' });
                 return fs;
            }
            // This is a rename or move operation, so remove the old file entry
            delete newFs[activeFile.folderName][activeFile.fileName];
            if (Object.keys(newFs[activeFile.folderName]).length === 0) {
                delete newFs[activeFile.folderName];
            }
        }

        if (!newFs[newActiveFile.folderName]) {
            newFs[newActiveFile.folderName] = {};
        }
        newFs[newActiveFile.folderName][newActiveFile.fileName] = code;
        localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
        return newFs;
    });

    if (isNewFileOrRename) {
        setOpenFiles(of => {
            const newOpenFiles = [...of];
            newOpenFiles[activeFileIndex] = newActiveFile;
            return newOpenFiles;
        })
    }
    
    setIsSaveOpen(false);
    toast({ title: 'Code Saved', description: `Saved as ${trimmedFolderName}/${trimmedFileName}` });
  }, [saveForm, activeFile, code, toast, activeFileIndex]);
  
  const loadFile = useCallback((folderName: string, fileName: string) => {
    const fileToLoad: ActiveFile = { folderName, fileName };
    const existingTabIndex = openFiles.findIndex(f => f.fileName === fileName && f.folderName === folderName);

    if (existingTabIndex !== -1) {
        setActiveFileIndex(existingTabIndex);
    } else {
        setOpenFiles(of => [...of, fileToLoad]);
        setActiveFileIndex(openFiles.length);
    }
    setIsSettingsOpen(false);
  }, [openFiles]);

  const renameFile = useCallback((index: number, newFileName: string) => {
    let trimmedNewName = newFileName.trim();
    if (!trimmedNewName) {
        toast({ title: 'Error', description: 'File name cannot be empty.', variant: 'destructive' });
        return;
    }

    if (!trimmedNewName.endsWith('.js')) {
        trimmedNewName += '.js';
    }

    const oldFile = openFiles[index];
    const newFile = { ...oldFile, fileName: trimmedNewName };

    if (oldFile.fileName === newFile.fileName && oldFile.folderName === newFile.folderName) {
        return; // No change
    }

    if (fileSystem[oldFile.folderName]?.[trimmedNewName]) {
        toast({ title: 'Error', description: `A file named "${trimmedNewName}" already exists in this folder.`, variant: 'destructive' });
        return;
    }

    setFileSystem(fs => {
        const newFs = { ...fs };
        const fileContent = newFs[oldFile.folderName]?.[oldFile.fileName] ?? '';
        
        if (!newFs[newFile.folderName]) {
            newFs[newFile.folderName] = {};
        }
        newFs[newFile.folderName][newFile.fileName] = fileContent;

        if (newFs[oldFile.folderName]) {
            delete newFs[oldFile.folderName][oldFile.fileName];
            if (Object.keys(newFs[oldFile.folderName]).length === 0) {
                delete newFs[oldFile.folderName];
            }
        }

        localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
        return newFs;
    });

    setOpenFiles(of => {
        const newOpenFiles = [...of];
        newOpenFiles[index] = newFile;
        return newOpenFiles;
    });

    toast({ title: 'File Renamed', description: `Renamed to ${trimmedNewName}` });

  }, [openFiles, fileSystem, toast]);

  const handleAiCheckToggle = (value: boolean) => {
    if (value) {
        const apiKey = localStorage.getItem('gemini-api-key');
        if (!apiKey) {
            toast({
                title: 'Gemini API Key Required',
                description: 'Please add your Gemini API key in the settings panel to use this feature.',
                variant: 'destructive',
            });
            return;
        }
    }
    setSettings({ ...settings, errorChecking: value });
  };

  if (!isMounted) {
    return null; // Or a loading spinner
  }

  return (
    <div className="bg-background">
      <div className="sticky top-0 z-20 bg-background">
        <Header 
          onRun={handleRun} 
          onSettings={() => setIsSettingsOpen(true)} 
          isCompiling={isCompiling} 
          onSaveAs={handleSaveRequest} 
          onShare={handleShare}
          activeFile={activeFile} 
          hasActiveFile={!!activeFile}
        />
        <TabBar 
          openFiles={openFiles}
          activeFileIndex={activeFileIndex}
          onTabClick={setActiveFileIndex}
          onTabClose={closeTab}
          onNewFile={() => createNewFile(true)}
          onRenameFile={renameFile}
        />
      </div>
      <div className="p-4 grid grid-cols-1 gap-4">
        {activeFile ? (
            <CodeEditor
                code={code}
                onCodeChange={setCode}
                onUndo={undo}
                onRedo={redo}
                onDeleteFile={() => activeFile && deleteFile(activeFile.folderName, activeFile.fileName)}
                hasActiveFile={!!activeFile}
            />
        ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Open a file from the settings panel or create a new one to start coding.</p>
            </div>
        )}
        <div className="h-[75vh]" />
      </div>
      <SettingsPanel
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        fileSystem={fileSystem}
        onLoadFile={loadFile}
        onNewFile={() => createNewFile(false)}
        onDeleteFile={deleteFile}
      />
      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="max-w-2xl h-3/4 flex flex-col">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>Result</DialogTitle>
              <div className="flex items-center space-x-2">
                <Label htmlFor="error-checking-toggle" className="text-sm font-medium">
                  AI Error Check
                </Label>
                <Switch
                  id="error-checking-toggle"
                  checked={settings.errorChecking}
                  onCheckedChange={handleAiCheckToggle}
                />
              </div>
            </div>
          </DialogHeader>
          <div className="flex-grow overflow-hidden">
            <OutputDisplay output={output} isCompiling={isCompiling} isAiChecking={isAiChecking} />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Save Code</DialogTitle>
                <DialogDescription>
                    Enter a file and folder name to save your code.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="folderName" className="text-right">Folder</Label>
                    <Input id="folderName" value={saveForm.folderName} onChange={(e) => setSaveForm({...saveForm, folderName: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="fileName" className="text-right">File Name</Label>
                    <Input id="fileName" value={saveForm.fileName.replace(/\.js$/, '')} onChange={(e) => setSaveForm({...saveForm, fileName: e.target.value })} className="col-span-3" />
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleSave} disabled={!activeFile}>Save</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
       <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Code</DialogTitle>
            <DialogDescription>
              Anyone with this link can view your code.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 pt-2">
            {isSharing ? (
                <div className="flex items-center justify-center w-full">
                    <DotLoader /> 
                    <span className="ml-2">Generating link...</span>
                </div>
            ) : (
              <>
                <Input value={shareLink} readOnly />
                <Button onClick={handleCopyShareLink} size="icon" className="shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
