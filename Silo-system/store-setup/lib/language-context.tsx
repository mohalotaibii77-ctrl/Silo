'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useLayoutEffect } from 'react';

interface LanguageContextType {
  language: string;
  currency: string;
  isRTL: boolean;
  isLoading: boolean;
  setLanguage: (lang: string) => void;
  t: (en: string, ar: string) => string;
  formatCurrency: (amount: number) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  currency: 'SAR',
  isRTL: false,
  isLoading: true,
  setLanguage: () => {},
  t: (en) => en,
  formatCurrency: (amount) => `${amount.toFixed(3)} SAR`,
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
  const [currency, setCurrency] = useState<string>('SAR');
  const [isLoading, setIsLoading] = useState(true);
  const isRTL = language === 'ar';

  // Use useLayoutEffect to check language BEFORE paint
  useLayoutEffect(() => {
    // Get language from stored business data
    const storedBusiness = localStorage.getItem('setup_business');
    let detectedLanguage = 'en'; // Default to English
    let detectedCurrency = 'SAR'; // Default currency
    
    if (storedBusiness) {
      try {
        const business = JSON.parse(storedBusiness);
        if (business.language) {
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

  // Update document direction when language changes
  useEffect(() => {
    if (language) {
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }
  }, [language, isRTL]);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    // Update stored business data
    const storedBusiness = localStorage.getItem('setup_business');
    if (storedBusiness) {
      try {
        const business = JSON.parse(storedBusiness);
        business.language = lang;
        localStorage.setItem('setup_business', JSON.stringify(business));
      } catch {}
    }
  };

  // Simple translation helper
  const t = (en: string, ar: string) => (language === 'ar' ? ar : en);

  // Currency formatter
  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(3)} ${currency}`;
  };

  // Show loading spinner until language is determined
  if (isLoading || language === null) {
    return <LanguageLoadingSpinner />;
  }

  return (
    <LanguageContext.Provider value={{ language, currency, isRTL, isLoading, setLanguage, t, formatCurrency }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);

