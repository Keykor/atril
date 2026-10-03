import { useLiveQuery } from 'dexie-react-hooks';
import type { ReactNode } from 'react';
import { getSetting, setSetting } from '../../core/db/repos';
import { Switch } from '../../ui/controls';
import { t } from '../../app/strings';
import './settings.css';

export function SettingsScreen({ children }: { children?: ReactNode }) {
  const penOnly = useLiveQuery(() => getSetting('penOnlyDrawing', false), []) ?? false;
  return (
    <div className="settings">
      <header className="screen-header">
        <h1>{t.settings.title}</h1>
      </header>
      <section className="card">
        <Switch
          label={t.settings.penOnly}
          hint={t.settings.penOnlyHint}
          checked={penOnly}
          onChange={(v) => void setSetting('penOnlyDrawing', v)}
        />
      </section>
      {children}
      <p className="settings-version">{t.settings.version(__APP_VERSION__)}</p>
    </div>
  );
}
