
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

const defaultCode = `// Welcome to 24HrCoding!
// Use the settings panel to save and load your creations.
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
`;

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
            if (fs && typeof fs === 'object' && Object.keys(fs).length > 0) {
                return fs;
            }
        } catch (e) { /* fallback */ }
    }
    return { 'Examples': { 'Welcome.js': defaultCode } };
}

interface UseCompilerFsProps {
    initialCode?: string | null;
    variant?: 'default' | 'minimal';
    onCodeChange?: (code: string) => void;
}

export function useCompilerFs({ initialCode, variant = 'default', onCodeChange }: UseCompilerFsProps) {
  const { toast } = useToast();

  const [fileSystem, setFileSystem] = useState<FileSystem>({});
  const [openFiles, setOpenFiles] = useState<ActiveFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);
  const activeFile = activeFileIndex !== -1 ? openFiles[activeFileIndex] : null;

  const [_code, _setCode] = useState('');
  const [history, setHistory] = useState<string[]>([_code]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [isFsReady, setIsFsReady] = useState(false);

  const code = history[historyIndex];
  const debouncedCode = useDebounce(code, 500);
  const debouncedInternalCode = useDebounce(_code, 500);

  const setCode = useCallback((newCode: string) => {
    _setCode(newCode);
    setHistory(h => {
        const newHistory = h.slice(0, historyIndex + 1);
        newHistory.push(newCode);
        return newHistory;
    });
    setHistoryIndex(i => i + 1);
    if(onCodeChange) {
        onCodeChange(newCode);
    }
  }, [historyIndex, onCodeChange]);
  

  // Load initial file system from localStorage or props
  useEffect(() => {
    if (variant === 'minimal' && initialCode) {
      _setCode(initialCode);
      setHistory([initialCode]);
      setHistoryIndex(0);
      setIsFsReady(true);
      return;
    }

    const fs = getInitialFileSystem(initialCode);
    setFileSystem(fs);

    let initialOpen: ActiveFile[] = [];
    if (initialCode) {
        initialOpen = [{ folderName: 'Shared', fileName: 'Shared-Code.js' }];
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
    if (!initialCode) {
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
  }, [initialCode, variant]);

  // Load code into editor when active file changes
  useEffect(() => {
    if (!isFsReady || variant === 'minimal' || !activeFile) return;
    
    const codeToSet = fileSystem[activeFile.folderName]?.[activeFile.fileName] ?? '';

    if (codeToSet !== _code) {
      _setCode(codeToSet);
      setHistory([codeToSet]);
      setHistoryIndex(0);
       if (onCodeChange) {
        onCodeChange(codeToSet);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, isFsReady]);


  // Debounced save to file system state
  useEffect(() => {
    if (!isFsReady || variant === 'minimal' || !activeFile || initialCode) return;
    if (fileSystem[activeFile.folderName]?.[activeFile.fileName] !== debouncedInternalCode) {
        setFileSystem(fs => {
            const newFs = { ...fs };
            if (!newFs[activeFile.folderName]) {
                newFs[activeFile.folderName] = {};
            }
            newFs[activeFile.folderName][activeFile.fileName] = debouncedInternalCode;
            localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
            return newFs;
        });
    }
  }, [debouncedInternalCode, activeFile, isFsReady, fileSystem, initialCode, variant]);

  // Save open files and active index to localStorage
  useEffect(() => {
    if (!isFsReady || variant === 'minimal' || initialCode) return;
    localStorage.setItem('openFiles', JSON.stringify(openFiles));
    localStorage.setItem('activeFileIndex', String(activeFileIndex));
  }, [openFiles, activeFileIndex, isFsReady, initialCode, variant]);


  const addFile = useCallback((folderName: string, fileName: string, fileContent: string) => {
    setFileSystem(fs => {
      const newFs = { ...fs };
      if (!newFs[folderName]) {
        newFs[folderName] = {};
      }
      newFs[folderName][fileName] = fileContent;
      localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
      
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
  }, []);

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
    
    // Find a unique name
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
  }, [fileSystem]);

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
        localStorage.setItem('codeFileSystem', JSON.stringify(newFs));
        return newFs;
    });

    const fileIndexToRemove = openFiles.findIndex(f => f.fileName === fileName && f.folderName === folderName);
    if (fileIndexToRemove !== -1) {
        closeTab(fileIndexToRemove);
    }
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

  return {
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
  };
}

    