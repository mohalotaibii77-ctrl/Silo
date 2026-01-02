import React, { createContext, useContext, ReactNode } from 'react';

// Light theme colors
const lightColors = {
  background: '#F8F9FA',
  foreground: '#1A1D21',
  primary: '#0F172A',
  primaryForeground: '#FFFFFF',
  secondary: '#F5F5F5',
  secondaryForeground: '#1E293B',
  muted: '#F5F5F5',
  mutedForeground: '#64748B',
  card: '#FFFFFF',
  cardForeground: '#1A1D21',
  border: '#EBEBEB',
  input: '#F5F5F5',
  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',
  success: '#22C55E',
  successForeground: '#FFFFFF',
  surface: '#FFFFFF',
};

// Dark theme colors
const darkColors = {
  background: '#09090b',
  foreground: '#fafafa',
  primary: '#fafafa',
  primaryForeground: '#18181b',
  secondary: '#27272a',
  secondaryForeground: '#fafafa',
  muted: '#27272a',
  mutedForeground: '#a1a1aa',
  card: '#18181b',
  cardForeground: '#fafafa',
  border: '#27272a',
  input: '#27272a',
  destructive: '#dc2626',
  destructiveForeground: '#fafafa',
  success: '#22c55e',
  successForeground: '#fafafa',
  surface: '#18181b',
};

export type ThemeColors = typeof lightColors;

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@app_theme';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Single-theme mode: keep legacy `useTheme()` API but lock to light palette.
  // Business logic and theme selection should not block app rendering.
  const isDark = false;
  const colors = lightColors;
  const toggleTheme = () => {
    // no-op (single theme)
  };

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme }}>
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

export { lightColors, darkColors };
