import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/instrument-sans';
import '@fontsource/caveat/700.css';
import './tokens.css';
import { startDriveSync } from '../core/backup/drive';
import { App } from './App';

startDriveSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
