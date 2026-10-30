import { I18nProvider } from '../i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Editor from './Editor';
import { backendService } from '../service';
import '../styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider page="studio">
      <Editor service={backendService} />
    </I18nProvider>
  </StrictMode>,
);
