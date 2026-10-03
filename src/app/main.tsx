import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/instrument-sans';
import '@fontsource/caveat/700.css';
import '@vexflow-fonts/bravura/index.css'; // símbolos musicales (SMuFL), licencia OFL
import './tokens.css';
import { startDriveSync } from '../core/backup/drive';
import { startUpdates } from '../core/update';
import { App } from './App';

startDriveSync();
startUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
