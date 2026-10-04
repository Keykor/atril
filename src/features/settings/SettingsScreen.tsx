import type { ReactNode } from 'react';
import { t } from '../../app/strings';
import './settings.css';

export function SettingsScreen({ children }: { children?: ReactNode }) {
  return (
    <div className="settings">
      <header className="screen-header">
        <h1>{t.settings.title}</h1>
      </header>
      {children}
    </div>
  );
}
