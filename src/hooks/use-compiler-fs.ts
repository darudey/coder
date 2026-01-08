
'use client';

import { useCallback, useContext, useEffect } from 'react';
import { CompilerFsContext } from './use-compiler-fs-provider';

interface UseCompilerFsProps {
    initialCode?: string | null;
}

export function useCompilerFs(props?: UseCompilerFsProps) {
  const context = useContext(CompilerFsContext);
  if (!context) {
    throw new Error('useCompilerFs must be used within a CompilerFsProvider');
  }
  
  const { initialCode } = props || {};
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
  }, [setContextCode]);

  return { ...rest, code: context.code, setCode };
}
