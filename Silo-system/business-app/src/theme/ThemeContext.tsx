import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeColors, lightColors, darkColors, ColorScheme } from './colors';

interface ThemeContextType {
  colors: ThemeColors;
  colorScheme: ColorScheme;
  toggleTheme: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [colorScheme, setColorScheme] = useState<ColorScheme>(
    systemColorScheme === 'dark' ? 'dark' : 'light'
  );

  // Update when system theme changes
  useEffect(() => {
    if (systemColorScheme) {
      setColorScheme(systemColorScheme === 'dark' ? 'dark' : 'light');
    }
  }, [systemColorScheme]);

  const colors = colorScheme === 'dark' ? darkColors : lightColors;

  const toggleTheme = () => {
    setColorScheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const value: ThemeContextType = {
    colors,
    colorScheme,
    toggleTheme,
    setColorScheme,
    isDark: colorScheme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;

