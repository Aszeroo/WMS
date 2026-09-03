import { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import theme from 'antd/lib/theme';
import th_TH from 'antd/locale/th_TH';
import en_US from 'antd/locale/en_US';

export type Language = 'th' | 'en';

interface LocaleThemeContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  darkMode: boolean;
  setDarkMode: (mode: boolean) => void;
}

const LocaleThemeContext = createContext<LocaleThemeContextProps | undefined>(undefined);

export function LocaleThemeProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('th');
  const [darkMode, setDarkMode] = useState<boolean>(false);

  const antdLocale = language === 'th' ? th_TH : en_US;
  const themeObj = useMemo(() => ({
    algorithm: darkMode ? theme.darkAlgorithm : undefined,
  }), [darkMode]);

  return (
    <LocaleThemeContext.Provider value={{ language, setLanguage, darkMode, setDarkMode }}>
      <ConfigProvider locale={antdLocale} theme={themeObj}>
        {children}
      </ConfigProvider>
    </LocaleThemeContext.Provider>
  );
}

export function useLocaleTheme() {
  const context = useContext(LocaleThemeContext);
  if (context === undefined) {
    throw new Error('useLocaleTheme must be used within LocaleThemeProvider');
  }
  return context;
}
