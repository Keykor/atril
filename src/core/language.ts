export type Language = 'es' | 'en';
export type LanguagePref = Language | 'auto';

// En localStorage y no en la base: tiene que estar antes del primer render (los textos se
// eligen al cargar) y es de cada dispositivo, así que no viaja en el backup.
const KEY = 'atril.language';

/** El primer idioma de la lista que sea español o inglés; si no hay ninguno, inglés. */
export function detectLanguage(languages: readonly string[]): Language {
  const first = languages.find((l) => /^(es|en)\b/i.test(l));
  return first?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function getLanguagePref(): LanguagePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'es' || v === 'en' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Guarda la preferencia. Toma efecto al recargar: `t` y `language` se resuelven una vez. */
export function setLanguagePref(pref: LanguagePref) {
  if (pref === 'auto') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, pref);
}

const deviceLanguages = () =>
  typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);

/** Idioma del dispositivo, para mostrar qué elige "Automático". */
export const deviceLanguage = detectLanguage(deviceLanguages());

/** Idioma de esta carga de la app. */
export const language: Language = (() => {
  const pref = getLanguagePref();
  return pref === 'auto' ? deviceLanguage : pref;
})();
