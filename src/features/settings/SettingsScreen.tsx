import type { ReactNode } from 'react';
import {
  deviceLanguage,
  getLanguagePref,
  setLanguagePref,
  type LanguagePref,
} from '../../core/language';
import { notation, setNotationPref, type Notation } from '../../core/audio/notes';
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

/** Idioma y cifrado. Cambiarlos recarga: textos y nombres de notas se eligen una vez, al abrir. */
export function LanguageCard() {
  const change = (pref: LanguagePref) => {
    setLanguagePref(pref);
    location.reload();
  };
  const changeNotation = (n: Notation) => {
    setNotationPref(n);
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
      <Segmented
        label={s.notation}
        value={notation}
        options={[
          { value: 'solfege', label: s.notationNames.solfege },
          { value: 'letters', label: s.notationNames.letters },
        ]}
        onChange={changeNotation}
      />
      <p>{s.notationHint}</p>
    </section>
  );
}
