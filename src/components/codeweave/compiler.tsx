
'use client';

import React, { useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { shareCode } from '@/app/actions';
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
import { errorCheck } from '@/ai/flows/error-checking';
import { useGoogleDrive } from '@/hooks/use-google-drive';

export interface ActiveFile {
    folderName: string;
    fileName: string;
}

export interface FileSystem {
  [folderName: string]: {
    [fileName: string]: string;
  };
}

export interface RunResult {
    output: string;
    type: 'result' | 'error';
    aiAnalysis?: string;
}

export interface Settings {
  errorChecking: boolean;
}

const defaultCode = `// Welcome to 24HrCoding!
// Use the settings panel to save and load your creations.
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
`;

interface CompilerProps {
  initialCode?: string | null;
  variant?: 'default' | 'minimal';
  hideHeader?: boolean;
  onCodeChange?: (code: string) => void;
}

export interface CompilerRef {
    run: () => Promise<RunResult>;
    getCode: () => string;
}

const getInitialFileSystem = (initialCode?: string | null): FileSystem => {
    if (typeof window === 'undefined') {
        return { 'Examples': { 'Welcome.js': initialCode || defaultCode } };
    }
    
    if (initialCode) {
        return { 'Shared': { 'Shared-Code.js': initialCode } };
    }

    const saved = localStorage.getItem('codeFileSystem');
    if (saved) {
        try {
            const fs = JSON.parse(saved);
            // Basic validation
            if (fs && typeof fs === 'object' && Object.keys(fs).length > 0) {
                return fs;
            }
        } catch (e) {
            console.error("Failed to parse file system from localStorage", e);
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


const CompilerWithRef = forwardRef<CompilerRef, CompilerProps>(({ initialCode, variant = 'default', hideHeader = false, onCodeChange }, ref) => {
  const { toast } = useToast();
  const { saveFileToDrive, openFileFromDrive } = useGoogleDrive();
  
  const [isMounted, setIsMounted] = useState(false);
  const [fileSystem, setFileSystem] = useState<FileSystem>({});
  
  const [openFiles, setOpenFiles] = useState<ActiveFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);
  const activeFile = activeFileIndex !== -1 ? openFiles[activeFileIndex] : null;

  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);

  const code = history[historyIndex] ?? '';
  const debouncedCode = useDebounce(code, 500);

  // Initialization Effect
  useEffect(() => {
      setIsMounted(true);
      const fs = getInitialFileSystem(initialCode);
      setFileSystem(fs);
      
      let initialOpenFiles: ActiveFile[] = [];
      // If initialCode is provided (e.g., from a shared link), open that file.
      if (initialCode) {
          initialOpenFiles = [{ folderName: 'Shared', fileName: 'Shared-Code.js' }];
      } else {
        // Otherwise, try to load last open files from localStorage.
        const savedOpenFiles = localStorage.getItem('openFiles');
        if (savedOpenFiles) {
            try {
                const parsed = JSON.parse(savedOpenFiles);
                if(Array.isArray(parsed)) {
                    // Filter out files that no longer exist in the file system
                    initialOpenFiles = parsed.filter(f => fs[f.folderName]?.[f.fileName] !== undefined);
                }
            } catch (e) { console.error("Failed to parse open files", e); }
        }
      }

      // If no open files could be restored, open the first available file as a fallback.
      if (initialOpenFiles.length === 0) {
          const fallbackFolder = Object.keys(fs)[0];
          if (fallbackFolder && fs[fallbackFolder] && Object.keys(fs[fallbackFolder]).length > 0) {
            const fallbackFile = Object.keys(fs[fallbackFolder])[0];
            initialOpenFiles = [{ folderName: fallbackFolder, fileName: fallbackFile }];
          }
      }

      if (initialOpenFiles.length > 0) {
        setOpenFiles(initialOpenFiles);
        // Restore active tab index unless it's a shared link
        let initialActiveIndex = 0;
        if (!initialCode) {
            const savedActiveIndex = localStorage.getItem('activeFileIndex');
            if(savedActiveIndex) {
                const parsedIndex = parseInt(savedActiveIndex, 10);
                if (parsedIndex >= 0 && parsedIndex < initialOpenFiles.length) {
                    initialActiveIndex = parsedIndex;
                }
            }
        }
        setActiveFileIndex(initialActiveIndex);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  // Save to Local Storage Effect
  useEffect(() => {
    if (isMounted && !initialCode) { // Do not save shared links to local storage
        localStorage.setItem('codeFileSystem', JSON.stringify(fileSystem));
        localStorage.setItem('openFiles', JSON.stringify(openFiles));
        localStorage.setItem('activeFileIndex', String(activeFileIndex));
    }
  }, [fileSystem, openFiles, activeFileIndex, isMounted, initialCode]);


  // Sync debounced code back to the file system state
  useEffect(() => {
    if (debouncedCode !== undefined && activeFile && isMounted) {
      if(fileSystem[activeFile.folderName]?.[activeFile.fileName] !== debouncedCode) {
        setFileSystem(fs => {
            const newFs = { ...fs };
            if (newFs[activeFile.folderName]) {
                newFs[activeFile.folderName][activeFile.fileName] = debouncedCode;
            }
            return newFs;
        });
      }
    }
  }, [debouncedCode, activeFile, isMounted, fileSystem]);

  // Effect to load file content into the editor's history when the active file changes.
  useEffect(() => {
      if (!isMounted || !activeFile) return;

      const content = fileSystem[activeFile.folderName]?.[activeFile.fileName];
      
      // If content is not yet available, do nothing. This effect will re-run when it is.
      if (content === undefined) return;
      
      // Prevent resetting history if the content is already what's in the editor
      if (history[historyIndex] === content) return;

      setHistory([content]);
      setHistoryIndex(0);
      onCodeChange?.(content);
  // The key is to depend on the *specific* file content from the filesystem.
  }, [isMounted, activeFile?.folderName, activeFile?.fileName, fileSystem[activeFile?.folderName]?.[activeFile?.fileName]]);


  const [isCompiling, setIsCompiling] = useState(false);
  const [isAiChecking, setIsAiChecking] = useState(false);
  const [settings, setSettings] = useState<Settings>({ errorChecking: false });
  const [output, setOutput] = useState<RunResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ fileName: '', folderName: '' });

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const handleCodeChange = useCallback((newCode: string) => {
    if (onCodeChange) {
        onCodeChange(newCode);
    }
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newCode);
    setHistory(newHistory);
    setHistoryIndex(i => i + 1);
  }, [history, historyIndex, onCodeChange]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  }, [historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  }, [historyIndex, history.length]);
  
  const handleRun = useCallback(async (): Promise<RunResult> => {
    if (variant !== 'minimal') {
        setIsCompiling(true);
        setIsResultOpen(true);
        setOutput(null);
    }
    
    let result: RunResult;
    
    if (settings.errorChecking) {
      setIsAiChecking(true);
      result = await runCodeOnClient(code);
      if (result.type === 'error') {
        try {
          const aiResult = await errorCheck({ code });
          if(aiResult.hasErrors && aiResult.errors.length > 0) {
            const analysis = aiResult.errors.map(e => `- **${e.summary}**\n  ${e.explanation}`).join('\n\n');
            result.aiAnalysis = `#### AI Analysis\n${analysis}`;
          }
        } catch (e: any) {
            console.error("AI error check failed:", e);
            result.aiAnalysis = "AI analysis failed. Please check your Gemini API key and try again.";
        }
      }
      setIsAiChecking(false);
    } else {
        result = await runCodeOnClient(code);
    }

    if (variant !== 'minimal') {
        setOutput(result);
        setIsCompiling(false);
    }
    
    return result;
  }, [code, settings.errorChecking, variant]);

  useImperativeHandle(ref, () => ({
    run: handleRun,
    getCode: () => code,
  }));

  const createNewFile = useCallback((activate = true) => {
    let nextFileNumber = 0;
    const prefix = "24hrcoding";
    const extension = ".js";

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
        return newFs;
    });

    if (activate) {
        setOpenFiles(of => {
            const newOpenFiles = [...of, newFile];
            setActiveFileIndex(newOpenFiles.length - 1);
            return newOpenFiles;
        });
    }
  }, [fileSystem]);

  const loadFile = useCallback((folderName: string, fileName: string, fileContent?: string) => {
    const existingIndex = openFiles.findIndex(f => f.folderName === folderName && f.fileName === fileName);

    if (existingIndex !== -1) {
        setActiveFileIndex(existingIndex);
        return;
    }

    setFileSystem(fs => {
        const newFs = { ...fs };
        if (!newFs[folderName]) newFs[folderName] = {};
        
        const contentExists = newFs[folderName]?.[fileName] !== undefined;

        // Only write content if it's explicitly provided (from Drive) or if the file doesn't exist yet
        if (fileContent !== undefined || !contentExists) {
            newFs[folderName][fileName] = fileContent ?? defaultCode;
        }
        
        setOpenFiles(of => {
            const newOpenFiles = [...of, { folderName, fileName }];
            // Set active index AFTER updating open files
            setTimeout(() => setActiveFileIndex(newOpenFiles.length - 1), 0);
            return newOpenFiles;
        });
        return newFs;
    });
  }, [openFiles]);

  const closeTab = useCallback((indexToClose: number) => {
    setOpenFiles(of => {
        const newOpenFiles = of.filter((_, i) => i !== indexToClose);

        if (newOpenFiles.length === 0) {
            setActiveFileIndex(-1);
        } else if (indexToClose < activeFileIndex) {
            setActiveFileIndex(i => i - 1);
        } else if (indexToClose === activeFileIndex) {
            // If we closed the active tab, move to the one before it, or the new last one.
            if (indexToClose >= newOpenFiles.length) {
                setActiveFileIndex(newOpenFiles.length - 1);
            }
            // No change needed if we closed a tab after the active one.
        }
        return newOpenFiles;
    });
  }, [activeFileIndex]);

  const deleteFile = useCallback((folderName: string, fileName: string) => {
    const fileIndexToRemove = openFiles.findIndex(f => f.fileName === fileName && f.folderName === folderName);
    if (fileIndexToRemove !== -1) {
        closeTab(fileIndexToRemove);
    }

    setFileSystem(fs => {
        const newFs = { ...fs };
        if (newFs[folderName]) {
            delete newFs[folderName][fileName];
            if (Object.keys(newFs[folderName]).length === 0) {
                delete newFs[folderName];
            }
        }
        return newFs;
    });
  }, [openFiles, closeTab]);

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

    // No change if name is the same
    if (oldFile.fileName === newFile.fileName && oldFile.folderName === newFile.folderName) return;

    if (fileSystem[oldFile.folderName]?.[trimmedNewName]) {
        toast({ title: 'Error', description: `A file named "${trimmedNewName}" already exists.`, variant: 'destructive' });
        return;
    }

    setFileSystem(fs => {
        const newFs = { ...fs };
        const fileContent = newFs[oldFile.folderName]?.[oldFile.fileName] ?? '';
        
        if (!newFs[newFile.folderName]) newFs[newFile.folderName] = {};
        newFs[newFile.folderName][newFile.fileName] = fileContent;

        if (newFs[oldFile.folderName]) {
            delete newFs[oldFile.folderName][oldFile.fileName];
            if (Object.keys(newFs[oldFile.folderName]).length === 0) delete newFs[oldFile.folderName];
        }
        
        setOpenFiles(of => {
            const newOpenFiles = [...of];
            newOpenFiles[index] = newFile;
            return newOpenFiles;
        });
        
        return newFs;
    });

    toast({ title: 'File Renamed', description: `Renamed to ${trimmedNewName}` });
  }, [openFiles, fileSystem, toast]);


  const handleSaveRequest = useCallback(() => {
    if (!activeFile) return;
    setSaveForm({ 
        fileName: activeFile.fileName, 
        folderName: activeFile.folderName
    });
    setIsSaveOpen(true);
  }, [activeFile]);
  
  const handleSaveToDrive = () => {
      if (!activeFile) {
          toast({ title: "No file open", description: "Please open a file to save to Google Drive.", variant: "destructive" });
          return;
      }
      const fileContent = code;
      const fileName = activeFile.fileName;
      saveFileToDrive(fileName, fileContent);
  }

  const handleOpenFileFromDrive = async () => {
    const file = await openFileFromDrive();
    if (file) {
      loadFile('Google Drive', file.fileName, file.content);
      setIsSettingsOpen(false);
    }
  }


  const handleShare = useCallback(async () => {
    const codeToShare = variant === 'minimal' ? code : fileSystem[activeFile!.folderName]?.[activeFile!.fileName];

    if (!codeToShare) {
        toast({ title: 'Error', description: 'No active file to share.', variant: 'destructive' });
        return;
    }
    
    setIsSharing(true);
    setShareDialogOpen(true);
    setShareLink('');

    const result = await shareCode(codeToShare);
    
    if ('id' in result) {
        const url = `${window.location.origin}/s/${result.id}`;
        setShareLink(url);
    } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        setShareLink('');
        setShareDialogOpen(false);
    }
    setIsSharing(false);
  }, [activeFile, fileSystem, toast, variant, code]);

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast({ title: 'Copied!', description: 'Share link copied to clipboard.' });
  };

  const handleSave = useCallback(() => {
      let trimmedFileName = saveForm.fileName.trim();
      const trimmedFolderName = saveForm.folderName.trim();

      if (!trimmedFileName || !trimmedFolderName) {
          toast({ title: 'Error', description: 'File and folder names cannot be empty.', variant: 'destructive' });
          return;
      }
      
      if (!trimmedFileName.endsWith('.js')) trimmedFileName += '.js';

      const newActiveFile = { fileName: trimmedFileName, folderName: trimmedFolderName };
      const isNewFileOrRename = activeFile!.fileName !== newActiveFile.fileName || activeFile!.folderName !== newActiveFile.folderName;

      setFileSystem(fs => {
          const newFs = { ...fs };
          
          if (isNewFileOrRename) {
              if (newFs[newActiveFile.folderName]?.[newActiveFile.fileName]) {
                   toast({ title: 'Error', description: 'A file with that name already exists.', variant: 'destructive' });
                   return fs;
              }
              delete newFs[activeFile!.folderName][activeFile!.fileName];
              if (Object.keys(newFs[activeFile!.folderName]).length === 0) delete newFs[activeFile!.folderName];
          }

          if (!newFs[newActiveFile.folderName]) newFs[newActiveFile.folderName] = {};
          newFs[newActiveFile.folderName][newActiveFile.fileName] = code;

          if (isNewFileOrRename) {
              setOpenFiles(of => {
                  const newOpenFiles = [...of];
                  newOpenFiles[activeFileIndex] = newActiveFile;
                  return newOpenFiles;
              });
          }

          return newFs;
      });

      toast({ title: 'Code Saved', description: `Saved as ${trimmedFolderName}/${trimmedFileName}` });
      setIsSaveOpen(false);

  }, [saveForm, activeFile, code, activeFileIndex, toast]);

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

  if (!isMounted && variant === 'default') {
    return null; // Or a loading spinner
  }

  const editorVisible = variant === 'default' ? !!activeFile : true;

  return (
    <div className="bg-background">
      <div className="sticky top-0 z-[999] bg-background">
        {!hideHeader && (
          <Header 
            onRun={handleRun} 
            onSettings={() => setIsSettingsOpen(true)} 
            isCompiling={isCompiling} 
            onSaveToBrowser={handleSaveRequest} 
            onSaveToDrive={handleSaveToDrive}
            onShare={handleShare}
            activeFile={activeFile} 
            hasActiveFile={!!activeFile}
            variant={variant}
          />
        )}
        {variant === 'default' && (
          <TabBar 
            openFiles={openFiles}
            activeFileIndex={activeFileIndex}
            onTabClick={setActiveFileIndex}
            onTabClose={closeTab}
            onNewFile={() => createNewFile(true)}
            onRenameFile={renameFile}
          />
        )}
      </div>
      <div className="p-4 grid grid-cols-1 gap-4">
        {editorVisible ? (
            <CodeEditor
                code={code}
                onCodeChange={handleCodeChange}
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
        onLoadFile={(folder, file) => {
            loadFile(folder, file);
            setIsSettingsOpen(false);
        }}
        onNewFile={() => {
            createNewFile(false);
        }}
        onDeleteFile={deleteFile}
        onOpenFileFromDrive={handleOpenFileFromDrive}
      />
      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="max-w-2xl h-3/4 flex flex-col">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <DialogTitle>Result</DialogTitle>
              <div className="flex items-center space-x-2">
                <Label htmlFor="error-checking-toggle" className="text-sm font-medium flex-shrink-0">
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
                <Button onClick={handleCopyShareLink} size="icon" className="shrink-0" disabled={!shareLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

CompilerWithRef.displayName = "Compiler";
export const Compiler = CompilerWithRef;

    