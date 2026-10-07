import type { ReactNode } from 'react';
import {
  deviceLanguage,
  getLanguagePref,
  setLanguagePref,
  type LanguagePref,
} from '../../core/language';
import { Segmented } from '../../ui/controls';
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

const s = t.settings;

/** Idioma de la app. Cambiarlo recarga: los textos se eligen una vez, al abrir. */
export function LanguageCard() {
  const change = (pref: LanguagePref) => {
    setLanguagePref(pref);
    location.reload();
  };
  return (
    <section className="card pad">
      <Segmented
        label={s.language}
        value={getLanguagePref()}
        options={[
          { value: 'auto', label: s.languageAuto },
          { value: 'es', label: s.languageNames.es },
          { value: 'en', label: s.languageNames.en },
        ]}
        onChange={change}
      />
      <p>{s.languageHint(s.languageNames[deviceLanguage])}</p>
    </section>
  );
}
