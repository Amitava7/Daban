import React, { createContext, useContext, useState } from 'react';
import { LightColors, DarkColors, ColorScheme, ThemeMode } from '../theme/colors';

interface ThemeContextValue {
  colors: ColorScheme;
  mode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LightColors,
  mode: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const colors = mode === 'light' ? LightColors : DarkColors;

  return (
    <ThemeContext.Provider value={{ colors, mode, toggleTheme: () => setMode(m => m === 'light' ? 'dark' : 'light') }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
