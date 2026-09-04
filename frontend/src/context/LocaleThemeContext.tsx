import { createContext, useContext, useState, useMemo, ReactNode, useEffect } from 'react';
import { ConfigProvider } from 'antd';
import theme from 'antd/lib/theme';
import th_TH from 'antd/locale/th_TH';
import en_US from 'antd/locale/en_US';
import i18n from '../i18n';

export type Language = 'th' | 'en';

interface LocaleThemeContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  darkMode: boolean;
  setDarkMode: (mode: boolean) => void;
}

const LocaleThemeContext = createContext<LocaleThemeContextProps | undefined>(undefined);

export function LocaleThemeProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage if available
  const getStoredLanguage = (): Language => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('wms2-language') as Language | null;
      if (stored === 'th' || stored === 'en') return stored;
    }
    return 'th';
  };
  const getStoredDarkMode = (): boolean => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('wms2-darkMode');
      return stored === 'true';
    }
    return false;
  };

  const [language, setLanguageState] = useState<Language>(getStoredLanguage);
  const [darkMode, setDarkModeState] = useState<boolean>(getStoredDarkMode);

  // Sync i18n language when language changes
  useEffect(() => {
    i18n.changeLanguage(language);
    window.localStorage.setItem('wms2-language', language);
  }, [language]);

  // Persist darkMode preference
  useEffect(() => {
    window.localStorage.setItem('wms2-darkMode', String(darkMode));
  }, [darkMode]);

  const antdLocale = language === 'th' ? th_TH : en_US;
  // Use defaultAlgorithm if available, otherwise fallback to undefined
  const themeObj = useMemo(() => ({
    algorithm: darkMode ? theme.darkAlgorithm : (theme.defaultAlgorithm ?? undefined),
  }), [darkMode]);

  return (
    <LocaleThemeContext.Provider value={{ language: language, setLanguage: setLanguageState, darkMode, setDarkMode: setDarkModeState }}>
      <ConfigProvider locale={antdLocale} theme={themeObj}>
        {children}
      </ConfigProvider>
    </LocaleThemeContext.Provider>
  );
}

export function useLocaleTheme() {
  const context = useContext(LocaleThemeContext);
  if (context === undefined) {
    throw new Error('useLocaleTheme must be used within LocaleThemeContext');
  }
  return context;
}