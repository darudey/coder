
'use client';

import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useToast } from './use-toast';
import { useDebounce } from './use-debounce';
import { CompilerFsContext, type CompilerFsContextType } from './use-compiler-fs-provider';

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

interface UseCompilerFsProps {
    initialCode?: string | null;
    variant?: 'default' | 'minimal';
    onCodeChange?: (code: string) => void;
}

export function useCompilerFs(props?: UseCompilerFsProps) {
  const context = useContext(CompilerFsContext);
  if (!context) {
    throw new Error('useCompilerFs must be used within a CompilerFsProvider');
  }

  const { onCodeChange } = props || {};
  const { setCode: setContextCode, ...rest } = context;

  const setCode = useCallback((newCode: string) => {
    setContextCode(newCode);
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  }, [setContextCode, onCodeChange]);

  return { ...rest, setCode };
}
