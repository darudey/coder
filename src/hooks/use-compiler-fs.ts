
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface ActiveFile {
    folderName: string;
    fileName: string;
}

export interface FileSystem {
  [folderName: string]: {
    [fileName: string]: string;
  };
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


export const useCompilerFs = (initialCode?: string | null) => {
    const { toast } = useToast();
    const [isMounted, setIsMounted] = useState(false);
    
    const [fileSystem, setFileSystem] = useState<FileSystem>({});
    const [openFiles, setOpenFiles] = useState<ActiveFile[]>([]);
    const [activeFileIndex, setActiveFileIndex] = useState(-1);
    
    const activeFile = activeFileIndex !== -1 ? openFiles[activeFileIndex] : null;

    // Initialization Effect
    useEffect(() => {
        setIsMounted(true);
        const fs = getInitialFileSystem(initialCode);
        setFileSystem(fs);

        let initialOpenFiles: ActiveFile[] = [];
        if (initialCode) {
            initialOpenFiles = [{ folderName: 'Shared', fileName: 'Shared-Code.js' }];
        } else {
            const savedOpenFiles = localStorage.getItem('openFiles');
            if (savedOpenFiles) {
                try {
                    const parsed = JSON.parse(savedOpenFiles);
                    if (Array.isArray(parsed)) {
                        initialOpenFiles = parsed.filter(f => fs[f.folderName]?.[f.fileName] !== undefined);
                    }
                } catch (e) { /* ignore */ }
            }
        }

        if (initialOpenFiles.length === 0) {
            const fallbackFolder = Object.keys(fs)[0];
            if (fallbackFolder && fs[fallbackFolder] && Object.keys(fs[fallbackFolder]).length > 0) {
                const fallbackFile = Object.keys(fs[fallbackFolder])[0];
                initialOpenFiles = [{ folderName: fallbackFolder, fileName: fallbackFile }];
            }
        }

        if (initialOpenFiles.length > 0) {
            setOpenFiles(initialOpenFiles);
            let initialActiveIndex = 0;
            if (!initialCode) {
                const savedActiveIndex = localStorage.getItem('activeFileIndex');
                if (savedActiveIndex) {
                    const parsedIndex = parseInt(savedActiveIndex, 10);
                    if (parsedIndex >= 0 && parsedIndex < initialOpenFiles.length) {
                        initialActiveIndex = parsedIndex;
                    }
                }
            }
            setActiveFileIndex(initialActiveIndex);
        } else {
            // If still no files, create a new one.
            createNewFile(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialCode]);

    // Persistence Effect
    useEffect(() => {
        if (!isMounted || initialCode) return; // Don't persist shared/initial code sessions

        localStorage.setItem('codeFileSystem', JSON.stringify(fileSystem));
        localStorage.setItem('openFiles', JSON.stringify(openFiles));
        localStorage.setItem('activeFileIndex', String(activeFileIndex));
    }, [fileSystem, openFiles, activeFileIndex, isMounted, initialCode]);

    const updateActiveFileCode = useCallback((code: string) => {
        if (activeFile) {
            setFileSystem(fs => {
                const newFs = { ...fs };
                newFs[activeFile.folderName][activeFile.fileName] = code;
                return newFs;
            });
        }
    }, [activeFile]);

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

            const finalContent = fileContent !== undefined ? fileContent : newFs[folderName]?.[fileName] ?? '';
            newFs[folderName][fileName] = finalContent;
            
            // This is the key fix: update open files and active index in the same state update as the file system
            setOpenFiles(of => {
                const newOpenFiles = [...of, { folderName, fileName }];
                setActiveFileIndex(newOpenFiles.length - 1);
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
                if (indexToClose >= newOpenFiles.length) {
                    setActiveFileIndex(newOpenFiles.length - 1);
                }
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

    const saveFile = useCallback((folder: string, file: string) => {
        let trimmedFileName = file.trim();
        const trimmedFolderName = folder.trim();

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
            newFs[newActiveFile.folderName][newActiveFile.fileName] = fs[activeFile!.folderName][activeFile!.fileName];

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
    }, [activeFile, activeFileIndex, toast]);

    return {
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
    };
}

    