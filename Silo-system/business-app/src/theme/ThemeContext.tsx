import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeColors, lightColors, darkColors, ColorScheme } from './colors';

interface ThemeContextType {
  colors: ThemeColors;
  colorScheme: ColorScheme;
  toggleTheme: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
  isDark: boolean;
  saveThemePreference: (theme: 'light' | 'dark' | 'system') => void;
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
  const [userPreference, setUserPreference] = useState<'light' | 'dark' | 'system'>('system');

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const userSettings = await AsyncStorage.getItem('userSettings');
        if (userSettings) {
          const settings = JSON.parse(userSettings);
          const savedTheme = settings.preferred_theme || 'system';
          setUserPreference(savedTheme);
          
          if (savedTheme === 'system') {
            setColorScheme(systemColorScheme === 'dark' ? 'dark' : 'light');
          } else {
            setColorScheme(savedTheme as ColorScheme);
          }
        }
      } catch (error) {
        console.log('Error loading theme preference:', error);
      }
    };
    
    loadThemePreference();
  }, [systemColorScheme]);

  // Update when system theme changes (only if preference is 'system')
  useEffect(() => {
    if (userPreference === 'system' && systemColorScheme) {
      setColorScheme(systemColorScheme === 'dark' ? 'dark' : 'light');
    }
  }, [systemColorScheme, userPreference]);

  const colors = colorScheme === 'dark' ? darkColors : lightColors;

  // Save theme preference to AsyncStorage and sync to backend
  const saveThemePreference = useCallback(async (theme: 'light' | 'dark' | 'system') => {
    setUserPreference(theme);
    
    if (theme === 'system') {
      setColorScheme(systemColorScheme === 'dark' ? 'dark' : 'light');
    } else {
      setColorScheme(theme as ColorScheme);
    }
    
    try {
      // Update local storage
      const userSettings = await AsyncStorage.getItem('userSettings');
      let settings = userSettings ? JSON.parse(userSettings) : {};
      settings.preferred_theme = theme;
      await AsyncStorage.setItem('userSettings', JSON.stringify(settings));
      
      // Sync to backend (fire and forget)
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:9000/api';
        fetch(`${API_URL}/business-settings/user-settings`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ preferred_theme: theme }),
        }).catch(() => {}); // Ignore errors for background sync
      }
    } catch (error) {
      console.log('Error saving theme preference:', error);
    }
  }, [systemColorScheme]);

  const toggleTheme = () => {
    const newTheme = colorScheme === 'dark' ? 'light' : 'dark';
    saveThemePreference(newTheme);
  };

  const value: ThemeContextType = {
    colors,
    colorScheme,
    toggleTheme,
    setColorScheme,
    isDark: colorScheme === 'dark',
    saveThemePreference,
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

