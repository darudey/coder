'use client';

import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from './use-toast';
import { useDebounce } from './use-debounce';

// --- Types ---

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
  code: string;
  setCode: (newCode: string) => void;
  fileSystem: FileSystem;
  openFiles: ActiveFile[];
  activeFileIndex: number;
  activeFile: ActiveFile | null;
  hasActiveFile: boolean;
  isFsReady: boolean;
  history: string[];
  historyIndex: number;
  undo: () => void;
  redo: () => void;
  loadFile: (folderName: string, fileName: string) => void;
  addFile: (folderName: string, fileName: string, content: string) => void;
  createNewFile: (activate?: boolean) => void;
  closeTab: (index: number) => void;
  deleteFile: (folderName: string, fileName: string) => void;
  renameFile: (index: number, newName: string) => void;
  setActiveFileIndex: (index: number) => void;
}

// --- Default Values & Constants ---

const defaultCode = `// Welcome to 24HrCoding!
// Use the settings panel to save and load your creations.
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
`;

const DB_NAME = 'compiler-fs';
const DB_VERSION = 1;
const FS_STORE_NAME = 'file-system';
const OPEN_FILES_STORE_NAME = 'open-files';
const ACTIVE_FILE_STORE_NAME = 'active-file';

// --- Context Definition ---

export const CompilerFsContext = createContext<CompilerFsContextType | undefined>(undefined);

// --- Provider Component ---

export function CompilerFsProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [isFsReady, setIsFsReady] = useState(false);

  const [fileSystem, setFileSystem] = useState<FileSystem>({ 'My Code': {} });
  const [openFiles, setOpenFiles] = useState<ActiveFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);

  const [code, setCode] = useState(defaultCode);
  const [history, setHistory] = useState<string[]>([defaultCode]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const activeFile = useMemo(() => openFiles[activeFileIndex] || null, [openFiles, activeFileIndex]);
  const debouncedCode = useDebounce(code, 500);

  // --- IndexedDB Initialization ---

  useEffect(() => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => console.error("Error opening IndexedDB");
    request.onsuccess = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      setDb(dbInstance);
      loadFromDb(dbInstance);
    };
    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(FS_STORE_NAME)) {
        dbInstance.createObjectStore(FS_STORE_NAME);
      }
      if (!dbInstance.objectStoreNames.contains(OPEN_FILES_STORE_NAME)) {
        dbInstance.createObjectStore(OPEN_FILES_STORE_NAME);
      }
       if (!dbInstance.objectStoreNames.contains(ACTIVE_FILE_STORE_NAME)) {
        dbInstance.createObjectStore(ACTIVE_FILE_STORE_NAME);
      }
    };
  }, []);

  const loadFromDb = useCallback(async (dbInstance: IDBDatabase) => {
    const transaction = dbInstance.transaction([FS_STORE_NAME, OPEN_FILES_STORE_NAME, ACTIVE_FILE_STORE_NAME], 'readonly');
    const get = <T>(storeName: string, key: string): Promise<T | undefined> =>
      new Promise((resolve, reject) => {
        const request = transaction.objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

    try {
      const [fsData, openFilesData, activeIndexData] = await Promise.all([
        get<FileSystem>(FS_STORE_NAME, 'root'),
        get<ActiveFile[]>(OPEN_FILES_STORE_NAME, 'tabs'),
        get<number>(ACTIVE_FILE_STORE_NAME, 'active'),
      ]);

      if (fsData && Object.keys(fsData).length > 0) {
        setFileSystem(fsData);
      } else {
        // Initialize with default file if DB is empty
        const initialFs = { 'My Code': { 'script.js': defaultCode } };
        setFileSystem(initialFs);
        setOpenFiles([{ folderName: 'My Code', fileName: 'script.js' }]);
        setActiveFileIndex(0);
        setCode(defaultCode);
        setHistory([defaultCode]);
        setHistoryIndex(0);
        setIsFsReady(true);
        return;
      }
      
      const loadedOpenFiles = openFilesData || [];
      const loadedActiveIndex = activeIndexData ?? -1;

      setOpenFiles(loadedOpenFiles);
      
      if (loadedActiveIndex !== -1 && loadedOpenFiles[loadedActiveIndex]) {
        const active = loadedOpenFiles[loadedActiveIndex];
        const fileContent = fsData[active.folderName]?.[active.fileName] ?? defaultCode;
        setCode(fileContent);
        setHistory([fileContent]);
        setHistoryIndex(0);
        setActiveFileIndex(loadedActiveIndex);
      } else if(loadedOpenFiles.length > 0) {
        // If saved index is bad but there are open files, open the first one
        const firstFile = loadedOpenFiles[0];
        const fileContent = fsData[firstFile.folderName]?.[firstFile.fileName] ?? defaultCode;
        setCode(fileContent);
        setHistory([fileContent]);
        setHistoryIndex(0);
        setActiveFileIndex(0);
      }

    } catch (error) {
      console.error("Failed to load from DB", error);
    } finally {
      setIsFsReady(true);
    }
  }, []);

  // --- IndexedDB Persistence ---

  useEffect(() => {
    if (!db || !isFsReady) return;
    const transaction = db.transaction([FS_STORE_NAME, OPEN_FILES_STORE_NAME, ACTIVE_FILE_STORE_NAME], 'readwrite');
    transaction.objectStore(FS_STORE_NAME).put(fileSystem, 'root');
    transaction.objectStore(OPEN_FILES_STORE_NAME).put(openFiles, 'tabs');
    transaction.objectStore(ACTIVE_FILE_STORE_NAME).put(activeFileIndex, 'active');
  }, [fileSystem, openFiles, activeFileIndex, db, isFsReady]);
  
  useEffect(() => {
    if (!db || !isFsReady || !activeFile) return;
    const { folderName, fileName } = activeFile;
    if (fileSystem[folderName]?.[fileName] !== debouncedCode) {
        setFileSystem(prevFs => ({
            ...prevFs,
            [folderName]: {
                ...prevFs[folderName],
                [fileName]: debouncedCode
            }
        }));
    }
  }, [debouncedCode, activeFile, fileSystem, db, isFsReady]);


  // --- History Management (Undo/Redo) ---
  useEffect(() => {
    const timeout = setTimeout(() => {
        if (code !== history[historyIndex]) {
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(code);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }
    }, 500);
    return () => clearTimeout(timeout);
  }, [code, history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCode(history[newIndex]);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCode(history[newIndex]);
    }
  }, [historyIndex, history]);

  // --- File Operations ---

  const loadFile = useCallback((folderName: string, fileName: string) => {
    const existingIndex = openFiles.findIndex(f => f.folderName === folderName && f.fileName === fileName);
    if (existingIndex !== -1) {
        setActiveFileIndex(existingIndex);
        return;
    }
    const fileContent = fileSystem[folderName]?.[fileName];
    if (typeof fileContent === 'string') {
        const newOpenFile = { folderName, fileName };
        const newOpenFiles = [...openFiles, newOpenFile];
        setOpenFiles(newOpenFiles);
        setActiveFileIndex(newOpenFiles.length - 1);
        setCode(fileContent);
        setHistory([fileContent]);
        setHistoryIndex(0);
    }
  }, [fileSystem, openFiles]);

  const addFile = useCallback((folderName: string, fileName: string, content: string) => {
    setFileSystem(prevFs => {
        const newFs = { ...prevFs };
        if (!newFs[folderName]) {
            newFs[folderName] = {};
        }
        newFs[folderName][fileName] = content;
        return newFs;
    });
    loadFile(folderName, fileName);
  }, [loadFile]);

  const createNewFile = useCallback((activate = true) => {
    let newFileName = 'untitled.js';
    let counter = 1;
    while (fileSystem['My Code']?.[newFileName]) {
        newFileName = `untitled-${counter++}.js`;
    }
    setFileSystem(prevFs => ({
        ...prevFs,
        'My Code': {
            ...prevFs['My Code'],
            [newFileName]: ''
        }
    }));
    if (activate) {
      loadFile('My Code', newFileName);
    }
  }, [fileSystem, loadFile]);
  
  const closeTab = useCallback((index: number) => {
    const newOpenFiles = openFiles.filter((_, i) => i !== index);
    setOpenFiles(newOpenFiles);
    
    if (activeFileIndex === index) {
      if (newOpenFiles.length > 0) {
        const newIndex = Math.max(0, index - 1);
        setActiveFileIndex(newIndex);
        const newActiveFile = newOpenFiles[newIndex];
        const fileContent = fileSystem[newActiveFile.folderName]?.[newActiveFile.fileName] ?? '';
        setCode(fileContent);
        setHistory([fileContent]);
        setHistoryIndex(0);
      } else {
        setActiveFileIndex(-1);
        setCode('');
        setHistory(['']);
        setHistoryIndex(0);
      }
    } else if (activeFileIndex > index) {
      setActiveFileIndex(activeFileIndex - 1);
    }
  }, [openFiles, activeFileIndex, fileSystem]);

  const deleteFile = useCallback((folderName: string, fileName: string) => {
      const fileIdentifier = `${folderName}/${fileName}`;
      const tabIndex = openFiles.findIndex(f => `${f.folderName}/${f.fileName}` === fileIdentifier);

      if (tabIndex !== -1) {
          closeTab(tabIndex);
      }

      setFileSystem(prevFs => {
          const newFs = { ...prevFs };
          delete newFs[folderName][fileName];
          if (Object.keys(newFs[folderName]).length === 0 && folderName !== 'My Code') {
              delete newFs[folderName];
          }
          return newFs;
      });

      toast({ title: "File Deleted", description: `${fileName} has been removed.` });
  }, [openFiles, closeTab, toast]);

  const renameFile = useCallback((index: number, newName: string) => {
    const fileToRename = openFiles[index];
    if (!fileToRename) return;
    const { folderName, fileName: oldName } = fileToRename;

    if (newName === oldName || !newName) return;
    if (fileSystem[folderName]?.[newName]) {
      toast({ title: 'Rename Failed', description: `A file named "${newName}" already exists.`, variant: 'destructive'});
      return;
    }

    setFileSystem(prevFs => {
      const newFolder = { ...prevFs[folderName] };
      newFolder[newName] = newFolder[oldName];
      delete newFolder[oldName];
      return { ...prevFs, [folderName]: newFolder };
    });

    setOpenFiles(prevOpen => prevOpen.map((file, i) => i === index ? { ...file, fileName: newName } : file));
  }, [fileSystem, openFiles, toast]);


  const contextValue = useMemo(() => ({
    code,
    setCode,
    fileSystem,
    openFiles,
    activeFileIndex,
    activeFile,
    hasActiveFile: !!activeFile,
    isFsReady,
    history,
    historyIndex,
    undo,
    redo,
    loadFile,
    addFile,
    createNewFile,
    closeTab,
    deleteFile,
    renameFile,
    setActiveFileIndex,
  }), [
    code, setCode, fileSystem, openFiles, activeFileIndex, activeFile, isFsReady,
    history, historyIndex, undo, redo, loadFile, addFile, createNewFile,
    closeTab, deleteFile, renameFile, setActiveFileIndex
  ]);

  return (
    <CompilerFsContext.Provider value={contextValue}>
      {children}
    </CompilerFsContext.Provider>
  );
}
