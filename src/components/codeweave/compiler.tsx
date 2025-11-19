
'use client';

import React, { useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { shareCode } from '@/app/actions';
import { CodeEditor } from './code-editor';
import { Header } from './header';
import { SettingsPanel } from './settings-panel';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OutputDisplay } from './output-display';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { TabBar } from './tab-bar';
import { Switch } from '../ui/switch';
import { Copy, Grab, X, GripHorizontal } from 'lucide-react';
import { DotLoader } from './dot-loader';
import { errorCheck } from '@/ai/flows/error-checking';
import { useGoogleDrive } from '@/hooks/use-google-drive';
import { useCompilerFs, type ActiveFile, type FileSystem } from '@/hooks/use-compiler-fs';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader } from '../ui/card';

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
  const isMobile = useIsMobile();
  
  const {
    fileSystem,
    openFiles,
    activeFileIndex,
    activeFile,
    isFsReady,
    code,
    history,
    historyIndex,
    setCode,
    loadFile,
    addFile,
    createNewFile,
    closeTab,
    deleteFile,
    renameFile,
    setActiveFileIndex,
  } = useCompilerFs({ initialCode, onCodeChange, variant });

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

  // State for draggable panel
  const [position, setPosition] = React.useState({ top: 80, left: window.innerWidth / 2 + 100 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });
  const elementStartPos = React.useRef({ top: 0, left: 0 });
  
  // State for resizable panel
  const [resizeMode, setResizeMode] = React.useState<'height' | 'width-left' | 'width-right' | null>(null);
  const [panelSize, setPanelSize] = React.useState({ width: 450, height: 400 });
  const resizeStartPos = React.useRef({ x: 0, y: 0, width: 0, height: 0, left: 0 });


  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    elementStartPos.current = { top: position.top, left: position.left };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Prevent the default touch action, like scrolling
    e.preventDefault();
    setIsDragging(true);
    const touch = e.touches[0];
    dragStartPos.current = { x: touch.clientX, y: touch.clientY };
    elementStartPos.current = { top: position.top, left: position.left };
};


  const handleMouseMove = React.useCallback((e: MouseEvent | TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (resizeMode) {
      if (resizeMode === 'height') {
        const deltaY = clientY - resizeStartPos.current.y;
        const newHeight = resizeStartPos.current.height + deltaY;
        setPanelSize(s => ({ ...s, height: Math.max(150, Math.min(newHeight, window.innerHeight - 50)) }));
      } else if (resizeMode === 'width-left') {
          const deltaX = clientX - resizeStartPos.current.x;
          const newWidth = resizeStartPos.current.width - deltaX;
          if (newWidth > 300) {
            setPanelSize(s => ({...s, width: newWidth}));
            setPosition(p => ({...p, left: resizeStartPos.current.left + deltaX}));
          }
      } else if (resizeMode === 'width-right') {
          const deltaX = clientX - resizeStartPos.current.x;
          const newWidth = resizeStartPos.current.width + deltaX;
          setPanelSize(s => ({...s, width: Math.max(300, newWidth)}));
      }
    } else if (isDragging) {
        const deltaX = clientX - dragStartPos.current.x;
        const deltaY = clientY - dragStartPos.current.y;
        setPosition({
          top: elementStartPos.current.top + deltaY,
          left: elementStartPos.current.left + deltaX,
        });
    }
  }, [isDragging, resizeMode]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
    setResizeMode(null);
  }, []);

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>, mode: 'height' | 'width-left' | 'width-right') => {
    e.preventDefault();
    e.stopPropagation();
    setResizeMode(mode);
    resizeStartPos.current = { 
      x: e.clientX, 
      y: e.clientY, 
      width: panelSize.width, 
      height: panelSize.height,
      left: position.left
    };
  };

  const handleResizeTouchStart = (e: React.TouchEvent<HTMLDivElement>, mode: 'height' | 'width-left' | 'width-right') => {
    e.preventDefault();
    e.stopPropagation();
    setResizeMode(mode);
    const touch = e.touches[0];
    resizeStartPos.current = { 
      x: touch.clientX, 
      y: touch.clientY, 
      width: panelSize.width, 
      height: panelSize.height,
      left: position.left
    };
  };

  React.useEffect(() => {
    if (isDragging || resizeMode) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('touchend', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, resizeMode, handleMouseMove, handleMouseUp]);


  const handleCodeChange = useCallback((newCode: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newCode);
    setCode(newCode, newHistory, historyIndex + 1);
  }, [history, historyIndex, setCode]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setCode(history[historyIndex - 1], history, historyIndex - 1);
    }
  }, [historyIndex, history, setCode]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setCode(history[historyIndex + 1], history, historyIndex + 1);
    }
  }, [historyIndex, history, setCode]);

  const handleRun = useCallback(async (): Promise<RunResult> => {
    if (variant !== 'minimal') {
        setIsCompiling(true);
        setIsResultOpen(true);
        setOutput(null); // Clear previous output
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

  const handleOpenFileFromDrive = useCallback(() => {
    openFileFromDrive((fileName, content) => {
      addFile('Google Drive', fileName, content);
      toast({
        title: 'File Opened from Drive',
        description: `${fileName} has been added to your files.`
      });
    });
  }, [openFileFromDrive, addFile, toast]);


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
        setShareDialogOpen(false); // Close dialog on error
    }
    setIsSharing(false);
  }, [activeFile, fileSystem, toast, variant, code]);

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast({ title: 'Copied!', description: 'Share link copied to clipboard.' });
  };
  
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

  if (!isFsReady && variant === 'default') {
    return null; // Or a loading spinner for the main compiler
  }

  const editorVisible = variant === 'default' ? !!activeFile : true;

  const DraggableOutputPanel = (
    <Card 
        className="fixed flex flex-col shadow-2xl z-40"
        style={{ 
          top: position.top, 
          left: position.left, 
          cursor: isDragging ? 'grabbing' : 'default', 
          width: `${panelSize.width}px`,
          height: `${panelSize.height}px` 
        }}
    >
      <div
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
        onMouseDown={(e) => handleResizeMouseDown(e, 'width-left')}
        onTouchStart={(e) => handleResizeTouchStart(e, 'width-left')}
      />
      <CardHeader 
        className="flex flex-row items-center justify-between p-2 border-b cursor-grab"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="flex items-center gap-2">
            <Grab className="w-4 h-4 text-muted-foreground" />
            <p className="font-semibold text-sm">Output</p>
        </div>
        <div className="flex items-center">
             <div className="flex items-center space-x-2 mr-2">
                <Label htmlFor="error-checking-toggle-float" className="text-xs font-medium flex-shrink-0">
                  AI Check
                </Label>
                <Switch
                  id="error-checking-toggle-float"
                  checked={settings.errorChecking}
                  onCheckedChange={handleAiCheckToggle}
                  className="h-5 w-9"
                />
              </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsResultOpen(false)}>
                <X className="w-4 h-4" />
            </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-hidden">
        <OutputDisplay output={output} isCompiling={isCompiling} isAiChecking={isAiChecking} />
      </CardContent>
      <div 
        className="w-full h-2 cursor-ns-resize flex items-center justify-center bg-muted/50"
        onMouseDown={(e) => handleResizeMouseDown(e, 'height')}
        onTouchStart={(e) => handleResizeTouchStart(e, 'height')}
      >
        <GripHorizontal className="w-4 h-4 text-muted-foreground/50" />
      </div>
       <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
        onMouseDown={(e) => handleResizeMouseDown(e, 'width-right')}
        onTouchStart={(e) => handleResizeTouchStart(e, 'width-right')}
      />
    </Card>
  );

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
                code={code || ''}
                onCodeChange={handleCodeChange}
                onUndo={undo}
                onRedo={redo}
                onDeleteFile={() => activeFile && deleteFile(activeFile.folderName, activeFile.fileName)}
                hasActiveFile={!!activeFile}
                onRun={handleRun}
            />
        ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Open a file from the settings panel or create a new one to start coding.</p>
            </div>
        )}
        <div className="h-[75vh]" />
      </div>

      {isResultOpen && !isMobile && DraggableOutputPanel}

      <SettingsPanel
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        fileSystem={fileSystem}
        onLoadFile={loadFile}
        onNewFile={() => createNewFile(false)}
        onDeleteFile={deleteFile}
        onOpenFileFromDrive={handleOpenFileFromDrive}
      />
      {isMobile && (
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
      )}
      
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

    