
'use client';

import { useCallback, useContext } from 'react';
import { CompilerFsContext } from './use-compiler-fs-provider';

interface UseCompilerFsProps {
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

  // Return a stable setCode function
  return { ...rest, setCode };
}
