'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useLayoutEffect, useCallback } from 'react';
import api from './api';

interface UserSettings {
  preferred_language: string;
  preferred_theme: 'light' | 'dark' | 'system';
  settings: Record<string, any>;
}

interface LanguageContextType {
  language: string;
  currency: string;
  isRTL: boolean;
  isLoading: boolean;
  userSettings: UserSettings | null;
  setLanguage: (lang: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  refreshBusinessSettings: () => Promise<void>;
  t: (en: string, ar: string) => string;
  formatCurrency: (amount: number) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  currency: '',
  isRTL: false,
  isLoading: true,
  userSettings: null,
  setLanguage: () => {},
  setTheme: () => {},
  updateUserSettings: async () => {},
  refreshBusinessSettings: async () => {},
  t: (en) => en,
  formatCurrency: (amount) => `${amount.toFixed(3)}`,
});

// Loading spinner component
function LanguageLoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
      </div>
    </div>
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>(''); // Loaded from business settings
  const [isLoading, setIsLoading] = useState(true);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const isRTL = language === 'ar';

  // Fetch fresh business settings from API
  const refreshBusinessSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('setup_token');
      if (!token) return;

      const response = await api.get('/business-settings/localization');
      if (response.data.data) {
        const data = response.data.data;
        // Update currency from backend (source of truth)
        if (data.currency) {
          setCurrency(data.currency);
          // Also update localStorage for consistency
          const storedBusiness = localStorage.getItem('setup_business');
          if (storedBusiness) {
            try {
              const business = JSON.parse(storedBusiness);
              business.currency = data.currency;
              localStorage.setItem('setup_business', JSON.stringify(business));
            } catch {}
          }
        } else {
          // Currency missing - this should not happen
          console.error('Business currency not set. Contact administrator.');
        }
      }
    } catch (error) {
      console.error('Failed to refresh business settings:', error);
    }
  }, []);

  // Use useLayoutEffect to check language BEFORE paint
  useLayoutEffect(() => {
    // Priority: User settings > Business settings > Default
    const storedUserSettings = localStorage.getItem('setup_user_settings');
    const storedBusiness = localStorage.getItem('setup_business');
    
    let detectedLanguage = 'en'; // Default to English
    let detectedCurrency = ''; // Loaded from business settings only
    let parsedUserSettings: UserSettings | null = null;
    
    // First, try to get from user settings (highest priority)
    if (storedUserSettings) {
      try {
        parsedUserSettings = JSON.parse(storedUserSettings);
        if (parsedUserSettings?.preferred_language) {
          detectedLanguage = parsedUserSettings.preferred_language;
        }
        setUserSettings(parsedUserSettings);
      } catch {}
    }
    
    // If no user setting, fall back to business settings
    if (storedBusiness) {
      try {
        const business = JSON.parse(storedBusiness);
        if (!parsedUserSettings?.preferred_language && business.language) {
          detectedLanguage = business.language;
        }
        if (business.currency) {
          detectedCurrency = business.currency;
        }
      } catch {}
    }
    
    // Apply direction immediately before any render
    document.documentElement.dir = detectedLanguage === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = detectedLanguage;
    
    setLanguageState(detectedLanguage);
    setCurrency(detectedCurrency);
    setIsLoading(false);
  }, []);

  // Fetch fresh currency from backend on mount (after initial render)
  useEffect(() => {
    // Small delay to ensure token is available after login redirect
    const timer = setTimeout(() => {
      refreshBusinessSettings();
    }, 100);
    return () => clearTimeout(timer);
  }, [refreshBusinessSettings]);

  // Update document direction when language changes
  useEffect(() => {
    if (language) {
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }
  }, [language, isRTL]);

  // Sync user settings to database
  const updateUserSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    try {
      const token = localStorage.getItem('setup_token');
      if (!token) return;

      // Update in database
      const response = await api.put('/business-settings/user-settings', newSettings);
      
      if (response.data.success) {
        // Update local state and localStorage
        const updatedSettings = response.data.data;
        setUserSettings(updatedSettings);
        localStorage.setItem('setup_user_settings', JSON.stringify(updatedSettings));
      }
    } catch (error) {
      console.error('Failed to update user settings:', error);
    }
  }, []);

  const setLanguage = useCallback((lang: string) => {
    setLanguageState(lang);
    
    // Update user settings in localStorage
    const storedUserSettings = localStorage.getItem('setup_user_settings');
    let updatedSettings: UserSettings = {
      preferred_language: lang,
      preferred_theme: 'system',
      settings: {},
    };
    
    if (storedUserSettings) {
      try {
        updatedSettings = { ...JSON.parse(storedUserSettings), preferred_language: lang };
      } catch {}
    }
    
    localStorage.setItem('setup_user_settings', JSON.stringify(updatedSettings));
    setUserSettings(updatedSettings);
    
    // Also update business data for backward compatibility
    const storedBusiness = localStorage.getItem('setup_business');
    if (storedBusiness) {
      try {
        const business = JSON.parse(storedBusiness);
        business.language = lang;
        localStorage.setItem('setup_business', JSON.stringify(business));
      } catch {}
    }
    
    // Sync to database (fire and forget)
    updateUserSettings({ preferred_language: lang });
  }, [updateUserSettings]);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    // Update user settings
    const storedUserSettings = localStorage.getItem('setup_user_settings');
    let updatedSettings: UserSettings = {
      preferred_language: language || 'en',
      preferred_theme: theme,
      settings: {},
    };
    
    if (storedUserSettings) {
      try {
        updatedSettings = { ...JSON.parse(storedUserSettings), preferred_theme: theme };
      } catch {}
    }
    
    localStorage.setItem('setup_user_settings', JSON.stringify(updatedSettings));
    setUserSettings(updatedSettings);
    
    // Sync to database (fire and forget)
    updateUserSettings({ preferred_theme: theme });
  }, [language, updateUserSettings]);

  // Simple translation helper
  const t = (en: string, ar: string) => (language === 'ar' ? ar : en);

  // Currency formatter - handles both normal prices and very small costs (e.g., cost per gram/ml)
  const formatCurrency = (amount: number, options?: { minDecimals?: number }) => {
    // For very small amounts (< 0.001), show more decimal places to avoid rounding to 0
    if (amount > 0 && amount < 0.001) {
      // Find how many decimals we need to show a non-zero value
      const significantDecimals = Math.max(4, -Math.floor(Math.log10(amount)) + 2);
      return `${amount.toFixed(Math.min(significantDecimals, 6))} ${currency}`;
    }
    // Standard 3 decimal places for normal amounts
    return `${amount.toFixed(options?.minDecimals ?? 3)} ${currency}`;
  };

  // Show loading spinner until language is determined
  if (isLoading || language === null) {
    return <LanguageLoadingSpinner />;
  }

  return (
    <LanguageContext.Provider value={{ 
      language, 
      currency, 
      isRTL, 
      isLoading, 
      userSettings,
      setLanguage, 
      setTheme,
      updateUserSettings,
      refreshBusinessSettings,
      t, 
      formatCurrency 
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);

