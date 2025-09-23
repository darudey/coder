
'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface Settings {
  editorFontSize: number;
}

interface SettingsContextValue {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const defaultSettings: Settings = {
  editorFontSize: 14,
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window === 'undefined') {
      return defaultSettings;
    }
    try {
      const item = window.localStorage.getItem('app-settings');
      return item ? JSON.parse(item) : defaultSettings;
    } catch (error) {
      console.error(error);
      return defaultSettings;
    }
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'system';
    }
    return (localStorage.getItem('theme') as Theme) || 'system';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('app-settings', JSON.stringify(settings));
    } catch (error) {
      console.error(error);
    }

    // Apply settings as CSS variables
    const root = window.document.documentElement;
    root.style.setProperty('--editor-font-size', `${settings.editorFontSize}px`);

  }, [settings]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    root.classList.add(effectiveTheme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const value = useMemo(() => ({
    settings,
    setSettings,
    theme,
    setTheme,
    toggleTheme,
  }), [settings, theme]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
