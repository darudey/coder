
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
import { useCompilerFs, type ActiveFile, type FileSystem } from '@/hooks/use-compiler-fs';


export interface RunResult {
    output: string;
    type: 'result' | 'error';
    aiAnalysis?: string;
}

export interface Settings {
  errorChecking: boolean;
}

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
  
  const {
      isMounted,
      fileSystem,
      openFiles,
      activeFileIndex,
      activeFile,
      setActiveFileIndex,
      updateActiveFileCode,
      createNewFile,
      loadFile,
      closeTab,
      deleteFile,
      renameFile,
      saveFile,
  } = useCompilerFs(initialCode);

  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const code = history[historyIndex] ?? '';
  const debouncedCode = useDebounce(code, 500);

  // Effect to sync debounced code back to the file system state
  useEffect(() => {
    if (debouncedCode !== undefined && activeFile && isMounted) {
      if (fileSystem[activeFile.folderName]?.[activeFile.fileName] !== debouncedCode) {
        updateActiveFileCode(debouncedCode);
      }
    }
  }, [debouncedCode, activeFile, isMounted, fileSystem, updateActiveFileCode]);

  // Effect to load file content into the editor's history when the active file changes
  useEffect(() => {
    if (!isMounted || !activeFile) return;

    const content = fileSystem[activeFile.folderName]?.[activeFile.fileName];
    if (content === undefined) return; // Wait for content to exist

    // Only reset history if the content is actually different
    if (history[historyIndex] !== content) {
      setHistory([content]);
      setHistoryIndex(0);
      onCodeChange?.(content);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      saveFile(saveForm.folderName, saveForm.fileName);
      setIsSaveOpen(false);
  }, [saveFile, saveForm]);

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

    