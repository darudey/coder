
'use client';

import { useCallback, useContext, useEffect } from 'react';
import { CompilerFsContext } from './use-compiler-fs-provider';

interface UseCompilerFsProps {
    initialCode?: string | null;
    onCodeChange?: (code: string) => void;
}

export function useCompilerFs(props?: UseCompilerFsProps) {
  const context = useContext(CompilerFsContext);
  if (!context) {
    throw new Error('useCompilerFs must be used within a CompilerFsProvider');
  }
  
  const { initialCode, onCodeChange } = props || {};
  const { setCode: setContextCode, setHistory: setContextHistory, setHistoryIndex: setContextHistoryIndex, ...rest } = context;

  // If an initialCode is provided, we need to reset the editor state
  useEffect(() => {
    if (typeof initialCode === 'string') {
      setContextHistory([initialCode]);
      setContextHistoryIndex(0);
    }
  }, [initialCode, setContextHistory, setContextHistoryIndex]);


  const setCode = useCallback((newCode: string) => {
    setContextCode(newCode);
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  }, [setContextCode, onCodeChange]);

  return { ...rest, setCode };
}
