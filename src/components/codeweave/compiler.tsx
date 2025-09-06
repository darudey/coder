
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { checkCodeForErrors, type RunResult } from '@/app/actions';
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
            return JSON.parse(saved);
        } catch (e) {
            return { 'Examples': { 'Welcome.js': defaultCode } };
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
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
    setFileSystem(getInitialFileSystem());
    const saved = localStorage.getItem('activeFile');
    if (saved) {
        try {
            const parsedFile = JSON.parse(saved);
            // Ensure the active file actually exists in the filesystem
            if (getInitialFileSystem()[parsedFile.folderName]?.[parsedFile.fileName]) {
                setActiveFile(parsedFile);
            } else {
                setActiveFile(null);
            }
        } catch (e) {
            setActiveFile(null);
        }
    }
  }, []);

  const getCodeFromState = () => {
    if (activeFile && fileSystem[activeFile.folderName]?.[activeFile.fileName] !== undefined) {
        return fileSystem[activeFile.folderName][activeFile.fileName];
    }
    if (!isMounted) return ''; // Return empty string during server render or before mount
    
    // Fallback logic
    if (Object.keys(fileSystem).length > 0) {
        const fallbackFolder = Object.keys(fileSystem)[0];
        if (Object.keys(fileSystem[fallbackFolder]).length > 0) {
            const fallbackFile = Object.keys(fileSystem[fallbackFolder])[0];
            if (!activeFile && isMounted) {
                setActiveFile({ folderName: fallbackFolder, fileName: fallbackFile });
            }
            return fileSystem[fallbackFolder][fallbackFile];
        }
    }
    return defaultCode;
  };

  const [history, setHistory] = useState<string[]>([getCodeFromState()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const code = history[historyIndex];
  const debouncedCode = useDebounce(code, 500);
  
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({ errorChecking: false });
  const [output, setOutput] = useState<RunResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ fileName: '', folderName: '' });
  const { toast } = useToast();

  const setCode = (newCode: string, fromHistory = false) => {
    if (!fromHistory) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newCode);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

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
  
  // This effect syncs the debounced code changes to the active file in the filesystem
  useEffect(() => {
    if (debouncedCode && activeFile && isMounted) {
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
  }, [debouncedCode, activeFile, isMounted]);
  
  // This effect loads the code from the active file into the editor
  useEffect(() => {
    if (!isMounted) return;
    const codeToSet = getCodeFromState();
    if(codeToSet !== code) {
      setHistory([codeToSet]);
      setHistoryIndex(0);
    }
  }, [activeFile, fileSystem, isMounted]);

  // This effect persists the active file to localStorage
  useEffect(() => {
    if (!isMounted) return;
    if (activeFile) {
        localStorage.setItem('activeFile', JSON.stringify(activeFile));
    } else {
        localStorage.removeItem('activeFile');
    }
  }, [activeFile, isMounted]);

  const handleRun = async () => {
    setIsCompiling(true);
    setIsResultOpen(true);
    let result = settings.errorChecking ? await checkCodeForErrors(code) : null;
    if (!result) {
        result = await runCodeOnClient(code);
    }
    setOutput(result);
    setIsCompiling(false);
  };

  const handleSaveRequest = () => {
    setSaveForm({ 
        fileName: activeFile?.fileName || '', 
        folderName: activeFile?.folderName || 'New Files' 
    });
    setIsSaveOpen(true);
  };

  const handleSave = () => {
    const { fileName, folderName } = saveForm;
    const trimmedFileName = fileName.trim();
    const trimmedFolderName = folderName.trim();

    if (!trimmedFileName || !trimmedFolderName) {
        toast({ title: 'Error', description: 'File and folder names cannot be empty.', variant: 'destructive' });
        return;
    }
    
    const newActiveFile = { fileName: trimmedFileName, folderName: trimmedFolderName };
    
    setFileSystem(fs => {
        const newFs = { ...fs };
        if (!newFs[newActiveFile.folderName]) {
            newFs[newActiveFile.folderName] = {};
        }
        newFs[newActiveFile.folderName][newActiveFile.fileName] = code;
        localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
        return newFs;
    });

    // Only change the active file if it's a new file or a rename
    if (!activeFile || activeFile.fileName !== newActiveFile.fileName || activeFile.folderName !== newActiveFile.folderName) {
        setActiveFile(newActiveFile);
    }
    
    setIsSaveOpen(false);
    toast({ title: 'Code Saved', description: `Saved as ${trimmedFolderName}/${trimmedFileName}` });
  };
  
  const loadFile = (folderName: string, fileName: string) => {
    setActiveFile({ folderName, fileName });
    setIsSettingsOpen(false);
  };
  
  const createNewFile = () => {
    const newFile = { folderName: 'New Files', fileName: `Untitled-${Date.now()}.js` };
    setFileSystem(fs => {
        const newFs = { ...fs };
        if (!newFs[newFile.folderName]) {
            newFs[newFile.folderName] = {};
        }
        newFs[newFile.folderName][newFile.fileName] = defaultCode;
        localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
        return newFs;
    });
    setActiveFile(newFile);
    setIsSettingsOpen(false);
  };

  const deleteFile = (folderName: string, fileName: string) => {
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

    if (activeFile?.folderName === folderName && activeFile?.fileName === fileName) {
        setActiveFile(null);
        setHistory([defaultCode]);
        setHistoryIndex(0);
    }
};

  if (!isMounted) {
    return null; // Or a loading spinner
  }

  return (
    <div className="flex flex-col h-screen">
      <Header 
        onRun={handleRun} 
        onSettings={() => setIsSettingsOpen(true)} 
        isCompiling={isCompiling} 
        onSaveAs={handleSaveRequest} 
        activeFile={activeFile} 
      />
      <div className="flex-grow p-4 grid grid-cols-1 gap-4 overflow-hidden">
        <CodeEditor
          code={code}
          onCodeChange={setCode}
          onUndo={undo}
          onRedo={redo}
          onDeleteFile={() => activeFile && deleteFile(activeFile.folderName, activeFile.fileName)}
          hasActiveFile={!!activeFile}
        />
      </div>
      <SettingsPanel
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        onSettingsChange={setSettings}
        fileSystem={fileSystem}
        onLoadFile={loadFile}
        onNewFile={createNewFile}
        onDeleteFile={deleteFile}
      />
      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="max-w-2xl h-3/4 flex flex-col">
          <DialogHeader>
            <DialogTitle>Result</DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-hidden">
            <OutputDisplay output={output} isCompiling={isCompiling} />
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
                    <Input id="fileName" value={saveForm.fileName} onChange={(e) => setSaveForm({...saveForm, fileName: e.target.value })} className="col-span-3" />
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
