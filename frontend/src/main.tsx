import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'antd/dist/reset.css';
import './styles.css';
import App from './App';
import i18n from './i18n'; // initialize i18next
import { LocaleThemeProvider } from './context/LocaleThemeContext';

export default function Main() {
  return (
    <LocaleThemeProvider>
      <StrictMode>
        <App />
      </StrictMode>
    </LocaleThemeProvider>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Main />);
