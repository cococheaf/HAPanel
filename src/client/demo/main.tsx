import { I18nProvider } from '../i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Demo from './Demo';
import '../styles.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider page="demo">
      <Demo />
    </I18nProvider>
  </StrictMode>,
);
