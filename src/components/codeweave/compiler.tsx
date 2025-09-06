
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

const runCodeOnClient = (code: string): RunResult => {
    try {
        const capturedLogs: any[] = [];
        const originalConsoleLog = console.log;

        const customLog = (...args: any[]) => {
            capturedLogs.push(args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch (e) {
                        return '[Circular Object]';
                    }
                }
                return String(arg);
            }).join(' '));
        };
        
        console.log = customLog;
        let result = (new Function(code))();
        console.log = originalConsoleLog;

        let output = capturedLogs.join('\n');

        if (result !== undefined) {
            const resultString = JSON.stringify(result, null, 2);
            output = output ? `${output}\n${resultString}` : resultString;
        } else if (capturedLogs.length === 0) {
            output = 'undefined';
        }

        return { output, type: 'result' };
    } catch (e: any) {
        return { output: `${e.name}: ${e.message}`, type: 'error' };
    }
}

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
            setActiveFile(JSON.parse(saved));
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
    const fallbackFolder = Object.keys(fileSystem)[0];
    if (!fallbackFolder) return defaultCode;
    const fallbackFile = Object.keys(fileSystem[fallbackFolder])[0];
    return fallbackFile ? fileSystem[fallbackFolder][fallbackFile] : defaultCode;
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

  useEffect(() => {
    if (!isMounted) return;
    const codeToSet = getCodeFromState();
    if(codeToSet !== code) {
      setHistory([codeToSet]);
      setHistoryIndex(0);
    }
  }, [activeFile, fileSystem, isMounted]);

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
        result = runCodeOnClient(code);
    }
    setOutput(result);
    setIsCompiling(false);
  };

  const handleSaveRequest = () => {
    setSaveForm({ 
        fileName: activeFile?.fileName || '', 
        folderName: activeFile?.folderName || '' 
    });
    setIsSaveOpen(true);
  };

  const handleSave = () => {
    const { fileName, folderName } = saveForm;
    if (!fileName.trim() || !folderName.trim()) {
        toast({ title: 'Error', description: 'File and folder names cannot be empty.', variant: 'destructive' });
        return;
    }
    
    const newActiveFile = { fileName: fileName.trim(), folderName: folderName.trim() };
    
    setFileSystem(fs => {
        let newFs = { ...fs };
        
        // If file was renamed or moved, remove the old entry
        if (activeFile && (activeFile.fileName !== newActiveFile.fileName || activeFile.folderName !== newActiveFile.folderName)) {
            if (newFs[activeFile.folderName]) {
                delete newFs[activeFile.folderName][activeFile.fileName];
                if (Object.keys(newFs[activeFile.folderName]).length === 0) {
                    delete newFs[activeFile.folderName];
                }
            }
        }
        
        if (!newFs[newActiveFile.folderName]) {
            newFs[newActiveFile.folderName] = {};
        }
        newFs[newActiveFile.folderName][newActiveFile.fileName] = code;
        
        localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
        return newFs;
    });

    setActiveFile(newActiveFile);
    setIsSaveOpen(false);
    toast({ title: 'Code Saved', description: `Saved as ${folderName}/${fileName}` });
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
      <Header onRun={handleRun} onSettings={() => setIsSettingsOpen(true)} isCompiling={isCompiling} onSave={handleSaveRequest} activeFile={activeFile} />
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

    