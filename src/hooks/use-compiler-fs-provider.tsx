
'use client';

import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from './use-toast';
import { useDebounce } from './use-debounce';

export type FileSystem = {
  [folderName: string]: {
    [fileName: string]: string;
  };
};

export interface ActiveFile {
    folderName: string;
    fileName: string;
}

export interface CompilerFsContextType {
    fileSystem: FileSystem;
    openFiles: ActiveFile[];
    activeFileIndex: number;
    activeFile: ActiveFile | null;
    isFsReady: boolean;
    code: string;
    history: string[];
    historyIndex: number;
    setCode: (newCode: string) => void;
    setHistory: (history: string[]) => void;
    setHistoryIndex: (index: number) => void;
    loadFile: (folderName: string, fileName: string) => void;
    addFile: (folderName: string, fileName: string, content: string) => void;
    createNewFile: (activate?: boolean) => void;
    closeTab: (index: number) => void;
    deleteFile: (folderName: string, fileName: string) => void;
    renameFile: (index: number, newName: string) => void;
    setActiveFileIndex: (index: number) => void;
}

export const CompilerFsContext = createContext<CompilerFsContextType | undefined>(undefined);

const defaultCode = `// Welcome to 24HrCoding!
// Use the settings panel to save and load your creations.
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
`;

const getInitialFileSystem = (initialCode?: string | null): FileSystem => {
    if (typeof window === 'undefined') {
        const baseFs: FileSystem = {};
        if (initialCode) {
            baseFs['Shared'] = { 'Shared-Code.js': initialCode };
        } else {
            baseFs['Examples'] = { 'Welcome.js': defaultCode };
        }
        return baseFs;
    }
    
    if (initialCode) {
        return { 'Shared': { 'Shared-Code.js': initialCode } };
    }

    const saved = localStorage.getItem('codeFileSystem');
    if (saved) {
        try {
            const fs = JSON.parse(saved);
            if (fs && typeof fs === 'object' && Object.keys(fs).length > 0) {
                return fs;
            }
        } catch (e) { /* fallback */ }
    }
    return { 'Examples': { 'Welcome.js': defaultCode } };
}

export function CompilerFsProvider({ children, initialCode: initialCodeFromProps }: { children: React.ReactNode, initialCode?: string | null }) {
  const { toast } = useToast();
  const [fileSystem, setFileSystem] = useState<FileSystem>({});
  const [openFiles, setOpenFiles] = useState<ActiveFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);
  const activeFile = activeFileIndex !== -1 ? openFiles[activeFileIndex] : null;

  const [history, setHistory] = useState<string[]>([defaultCode]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [isFsReady, setIsFsReady] = useState(false);

  const code = history[historyIndex] ?? defaultCode;
  const debouncedCode = useDebounce(code, 500);

  const setCode = useCallback((newCode: string) => {
    setHistory(h => {
        const newHistory = h.slice(0, historyIndex + 1);
        newHistory.push(newCode);
        return newHistory;
    });
    setHistoryIndex(i => i + 1);
  }, [historyIndex]);
  
  useEffect(() => {
    const fs = getInitialFileSystem(initialCodeFromProps);
    setFileSystem(fs);

    let initialOpen: ActiveFile[] = [];
    if (initialCodeFromProps) {
        initialOpen.push({ folderName: 'Shared', fileName: 'Shared-Code.js' });
    } else {
        try {
            const savedOpen = localStorage.getItem('openFiles');
            if (savedOpen) {
                const parsed = JSON.parse(savedOpen);
                if (Array.isArray(parsed)) {
                    initialOpen = parsed.filter(f => fs[f.folderName]?.[f.fileName] !== undefined);
                }
            }
        } catch (e) { /* ignore */ }
    }
    
    if (initialOpen.length === 0) {
        const fallbackFolder = Object.keys(fs)[0];
        if (fallbackFolder && Object.keys(fs[fallbackFolder]).length > 0) {
            const fallbackFile = Object.keys(fs[fallbackFolder])[0];
            initialOpen.push({ folderName: fallbackFolder, fileName: fallbackFile });
        }
    }

    setOpenFiles(initialOpen);

    let initialActive = 0;
    if (!initialCodeFromProps) {
        try {
            const savedActive = localStorage.getItem('activeFileIndex');
            if (savedActive) {
                const parsed = parseInt(savedActive, 10);
                if (parsed >= 0 && parsed < initialOpen.length) {
                    initialActive = parsed;
                }
            }
        } catch(e) { /* ignore */ }
    }
    setActiveFileIndex(initialOpen.length > 0 ? initialActive : -1);
    setIsFsReady(true);
  }, [initialCodeFromProps]);

  useEffect(() => {
    if (!isFsReady || !activeFile) return;
    
    const codeToSet = fileSystem[activeFile.folderName]?.[activeFile.fileName] ?? '';

    if (codeToSet !== code) {
      setHistory([codeToSet]);
      setHistoryIndex(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, isFsReady]);


  useEffect(() => {
    if (!isFsReady || !activeFile || initialCodeFromProps) return; // Don't save over shared code
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
  }, [debouncedCode, activeFile, isFsReady, fileSystem, initialCodeFromProps]);

  useEffect(() => {
    if (!isFsReady || initialCodeFromProps) return;
    localStorage.setItem('openFiles', JSON.stringify(openFiles));
    localStorage.setItem('activeFileIndex', String(activeFileIndex));
  }, [openFiles, activeFileIndex, isFsReady, initialCodeFromProps]);


  const addFile = useCallback((folderName: string, fileName: string, fileContent: string) => {
    setFileSystem(fs => {
      const newFs = { ...fs };
      if (!newFs[folderName]) {
        newFs[folderName] = {};
      }
      newFs[folderName][fileName] = fileContent;
      if(!initialCodeFromProps) localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
      
      setOpenFiles(of => {
        const existingIndex = of.findIndex(f => f.folderName === folderName && f.fileName === fileName);
        if (existingIndex !== -1) {
          setActiveFileIndex(existingIndex);
          return of;
        }
        const newOpenFiles = [...of, { folderName, fileName }];
        setActiveFileIndex(newOpenFiles.length - 1);
        return newOpenFiles;
      });

      return newFs;
    });
  }, [initialCodeFromProps]);

  const loadFile = useCallback((folderName: string, fileName: string) => {
    const existingIndex = openFiles.findIndex(f => f.folderName === folderName && f.fileName === fileName);
    if (existingIndex !== -1) {
        setActiveFileIndex(existingIndex);
        return;
    }
    const newOpenFiles = [...openFiles, { folderName, fileName }];
    setOpenFiles(newOpenFiles);
    setActiveFileIndex(newOpenFiles.length - 1);
  }, [openFiles]);

  const createNewFile = useCallback((activate = true) => {
    const prefix = "24hrcoding";
    const extension = ".js";
    let nextFileNumber = 1;
    let newFileName = `${prefix}${nextFileNumber}${extension}`;
    
    // eslint-disable-next-line no-loop-func
    while(Object.values(fileSystem).some(folder => folder[newFileName])) {
      nextFileNumber++;
      newFileName = `${prefix}${nextFileNumber}${extension}`;
    }

    const newFile = { folderName: 'New Files', fileName: newFileName };

    setFileSystem(fs => {
        const newFs = { ...fs };
        if (!newFs[newFile.folderName]) {
            newFs[newFile.folderName] = {};
        }
        newFs[newFile.folderName][newFile.fileName] = defaultCode;
        if(!initialCodeFromProps) localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
        return newFs;
    });

    if (activate) {
        setOpenFiles(of => {
            const newOpenFiles = [...of, newFile];
            setActiveFileIndex(newOpenFiles.length - 1);
            return newOpenFiles;
        });
    }
  }, [fileSystem, initialCodeFromProps]);

  const closeTab = useCallback((indexToClose: number) => {
    setOpenFiles(of => {
        const newOpenFiles = of.filter((_, i) => i !== indexToClose);
        if (newOpenFiles.length === 0) {
            setActiveFileIndex(-1);
        } else if (indexToClose < activeFileIndex) {
            setActiveFileIndex(i => i - 1);
        } else if (indexToClose === activeFileIndex) {
            setActiveFileIndex(i => Math.max(0, i - 1));
        }
        return newOpenFiles;
    });
  }, [activeFileIndex]);

  const deleteFile = useCallback((folderName: string, fileName: string) => {
    setFileSystem(fs => {
        const newFs = { ...fs };
        if (newFs[folderName]) {
            delete newFs[folderName][fileName];
            if (Object.keys(newFs[folderName]).length === 0) {
                delete newFs[folderName];
            }
        }
        if(!initialCodeFromProps) localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
        return newFs;
    });

    const fileIndexToRemove = openFiles.findIndex(f => f.fileName === fileName && f.folderName === folderName);
    if (fileIndexToRemove !== -1) {
        closeTab(fileIndexToRemove);
    }
  }, [openFiles, closeTab, initialCodeFromProps]);

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

    if (oldFile.fileName === newFile.fileName) return;

    if (fileSystem[oldFile.folderName]?.[trimmedNewName]) {
        toast({ title: 'Error', description: `A file named "${trimmedNewName}" already exists.`, variant: 'destructive' });
        return;
    }

    setFileSystem(fs => {
        const newFs = { ...fs };
        const content = newFs[oldFile.folderName]?.[oldFile.fileName] ?? '';
        delete newFs[oldFile.folderName][oldFile.fileName];
        newFs[oldFile.folderName][newFile.fileName] = content;
        if(!initialCodeFromProps) localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
        return newFs;
    });

    setOpenFiles(of => {
        const newOpenFiles = [...of];
        newOpenFiles[index] = newFile;
        return newOpenFiles;
    });

    toast({ title: 'File Renamed', description: `Renamed to ${trimmedNewName}` });
  }, [openFiles, fileSystem, toast, initialCodeFromProps]);

  const value = useMemo(() => ({
    fileSystem,
    openFiles,
    activeFileIndex,
    activeFile,
    isFsReady,
    code,
    history,
    historyIndex,
    setCode,
    setHistory,
    setHistoryIndex,
    loadFile,
    addFile,
    createNewFile,
    closeTab,
    deleteFile,
    renameFile,
    setActiveFileIndex,
  }), [
    fileSystem, openFiles, activeFileIndex, activeFile, isFsReady, code, history,
    historyIndex, setCode, loadFile, addFile, createNewFile, closeTab, deleteFile,
    renameFile, setActiveFileIndex
  ]);

  return (
    <CompilerFsContext.Provider value={value}>
      {children}
    </CompilerFsContext.Provider>
  );
}
