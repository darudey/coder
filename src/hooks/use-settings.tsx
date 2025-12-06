
'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface Settings {
  editorFontSize: number;
  isVirtualKeyboardEnabled: boolean;
  isFloatingOutputEnabled: boolean; // For mobile
  desktopOutputMode: 'side' | 'floating'; // For desktop
  isSessionOutputFloating: boolean; // For session page
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
  isVirtualKeyboardEnabled: true,
  isFloatingOutputEnabled: false,
  desktopOutputMode: 'side',
  isSessionOutputFloating: false,
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const [theme, setThemeState] = useState<Theme>('system');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem('app-settings');
      if (item) {
        const storedSettings = JSON.parse(item);
        // Merge stored settings with defaults to avoid breaking changes
        setSettings(prev => ({...defaultSettings, ...storedSettings}));
      }
      const storedTheme = localStorage.getItem('theme') as Theme;
      if (storedTheme) {
        setThemeState(storedTheme);
      }
    } catch (error) {
      console.error(error);
    }
    setIsInitialized(true);
  }, []);


  useEffect(() => {
    if (!isInitialized) return;
    try {
      window.localStorage.setItem('app-settings', JSON.stringify(settings));
    } catch (error) {
      console.error(error);
    }

    // Apply settings as CSS variables
    const root = window.document.documentElement;
    root.style.setProperty('--editor-font-size', `${settings.editorFontSize}px`);

  }, [settings, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    root.classList.add(effectiveTheme);
    localStorage.setItem('theme', theme);
  }, [theme, isInitialized]);
  
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };
  
  const toggleTheme = () => {
    setTheme(prevTheme => {
      if (prevTheme === 'system') {
        const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return systemIsDark ? 'light' : 'dark';
      }
      return prevTheme === 'light' ? 'dark' : 'light';
    });
  };

  const value = useMemo(() => ({
    settings,
    setSettings,
    theme,
    setTheme,
    toggleTheme,
  }), [settings, theme]);
  
  if (!isInitialized) {
    return null; // Prevents server-client mismatch on initial render
  }


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
