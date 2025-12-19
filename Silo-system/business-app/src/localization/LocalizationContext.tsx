import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, TranslationKey, Language } from './translations';

// Currency symbols mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  KWD: 'KD',
  USD: '$',
  EUR: '€',
  GBP: '£',
  SAR: 'SR',
  AED: 'AED',
  QAR: 'QR',
  BHD: 'BD',
  OMR: 'OMR',
};

interface LocalizationContextType {
  language: Language;
  isRTL: boolean;
  currency: string;
  t: (key: TranslationKey) => string;
  setLanguage: (lang: Language) => Promise<void>;
  refreshLanguage: () => Promise<void>;
  applyLanguageFromSettings: (lang: string) => void;
  formatCurrency: (amount: number, currencyOverride?: string) => string;
  refreshCurrency: () => Promise<void>;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [currency, setCurrency] = useState<string>(''); // Loaded from business settings
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadLanguage();
    loadCurrency();
  }, []);

  const loadLanguage = async () => {
    try {
      // Priority: userSettings > business settings > default
      const userSettingsStr = await AsyncStorage.getItem('userSettings');
      const businessStr = await AsyncStorage.getItem('business');
      
      let lang: Language = 'en';
      
      // First check user settings (highest priority)
      if (userSettingsStr) {
        try {
          const userSettings = JSON.parse(userSettingsStr);
          if (userSettings.preferred_language === 'ar' || userSettings.preferred_language === 'en') {
            lang = userSettings.preferred_language;
          }
        } catch {}
      }
      // Fall back to business settings if no user preference
      else if (businessStr) {
        try {
          const business = JSON.parse(businessStr);
          if (business.language === 'ar' || business.language === 'en') {
            lang = business.language;
          }
        } catch {}
      }
      
      setLanguageState(lang);
    } catch (error) {
      console.error('Error loading language:', error);
    } finally {
      setIsReady(true);
    }
  };

  const loadCurrency = async () => {
    try {
      const businessStr = await AsyncStorage.getItem('business');
      if (businessStr) {
        const business = JSON.parse(businessStr);
        if (business.currency) {
          setCurrency(business.currency);
        }
      }
    } catch (error) {
      console.error('Error loading currency:', error);
    }
  };

  const refreshCurrency = useCallback(async () => {
    await loadCurrency();
  }, []);

  const formatCurrency = useCallback((amount: number, currencyOverride?: string): string => {
    const currencyCode = currencyOverride || currency;
    const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
    return `${symbol} ${amount.toFixed(2)}`;
  }, [currency]);

  // Refresh language from storage (call after login or when settings change)
  const refreshLanguage = useCallback(async () => {
    try {
      // Priority: userSettings > business settings > current
      const userSettingsStr = await AsyncStorage.getItem('userSettings');
      const businessStr = await AsyncStorage.getItem('business');
      
      let lang: Language = language;
      
      // First check user settings (highest priority)
      if (userSettingsStr) {
        try {
          const userSettings = JSON.parse(userSettingsStr);
          if (userSettings.preferred_language === 'ar' || userSettings.preferred_language === 'en') {
            lang = userSettings.preferred_language;
          }
        } catch {}
      }
      // Fall back to business settings
      else if (businessStr) {
        try {
          const business = JSON.parse(businessStr);
          if (business.language === 'ar' || business.language === 'en') {
            lang = business.language;
          }
        } catch {}
      }
      
      setLanguageState(lang);
    } catch (error) {
      console.error('Error refreshing language:', error);
    }
  }, [language]);

  // Apply language directly (call during login with the language from response)
  const applyLanguageFromSettings = useCallback((lang: string) => {
    if (lang === 'ar' || lang === 'en') {
      setLanguageState(lang);
    }
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    
    // Update userSettings in local storage and save to database
    try {
      // Update local userSettings
      const userSettingsStr = await AsyncStorage.getItem('userSettings');
      let userSettings: any = { preferred_language: lang, preferred_theme: 'system', settings: {} };
      if (userSettingsStr) {
        userSettings = JSON.parse(userSettingsStr);
        userSettings.preferred_language = lang;
      }
      await AsyncStorage.setItem('userSettings', JSON.stringify(userSettings));
      
      // Save to database via API (user-specific setting, not business-wide)
      const api = require('../api/client').default;
      await api.put('/business-settings/user-settings', { preferred_language: lang });
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  const isRTL = language === 'ar';

  if (!isReady) {
    return null;
  }

  return (
    <LocalizationContext.Provider value={{ language, isRTL, currency, t, setLanguage, refreshLanguage, applyLanguageFromSettings, formatCurrency, refreshCurrency }}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}

