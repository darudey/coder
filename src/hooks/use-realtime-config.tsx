
'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';

interface RealtimeConfig {
  debounceDelay: number;
}

interface RealtimeConfigContextValue {
  debounceDelay: number;
  setDebounceDelay: (delay: number) => void;
}

const defaultRealtimeConfig: RealtimeConfig = {
  debounceDelay: 250,
};

const RealtimeConfigContext = createContext<RealtimeConfigContextValue | undefined>(undefined);

export function RealtimeConfigProvider({ children }: { children: React.ReactNode }) {
  const [debounceDelay, setDebounceDelay] = useState(defaultRealtimeConfig.debounceDelay);

  const value = useMemo(() => ({
    debounceDelay,
    setDebounceDelay,
  }), [debounceDelay]);
  
  return (
    <RealtimeConfigContext.Provider value={value}>
      {children}
    </RealtimeConfigContext.Provider>
  );
}

export function useRealtimeConfig() {
  const context = useContext(RealtimeConfigContext);
  if (context === undefined) {
    throw new Error('useRealtimeConfig must be used within a RealtimeConfigProvider');
  }
  return context;
}
