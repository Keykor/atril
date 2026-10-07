import type { StartNotes } from '../db/types';
import { language } from '../language';

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NAMES = {
  solfege: ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'],
  letters: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'],
};
export type Notation = keyof typeof NAMES;

// Como el idioma: preferencia del dispositivo, se lee al abrir y cambiarla recarga la app.
const KEY = 'atril.notation';

export function getNotationPref(): Notation | undefined {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'solfege' || v === 'letters' ? v : undefined;
  } catch {
    return undefined;
  }
}

export const setNotationPref = (n: Notation) => localStorage.setItem(KEY, n);

/** Cómo se muestran las notas: lo elegido o, si no, el del idioma. */
export const notation: Notation = getNotationPref() ?? (language === 'es' ? 'solfege' : 'letters');
const SEMITONE: Record<string, number> = {
  do: 0,
  re: 2,
  mi: 4,
  fa: 5,
  sol: 7,
  la: 9,
  si: 11,
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

/** "Fa4", "F4", "Do#4", "Sib3", "Bb3" -> número MIDI. Sin octava asume la 4. */
export function parseNote(text: string): number | undefined {
  const m = /^(do|re|mi|fa|sol|la|si|[a-g])(#|♯|b|♭)?(-?\d)?$/i.exec(text.trim());
  if (!m) return undefined;
  const acc = !m[2] ? 0 : m[2] === '#' || m[2] === '♯' ? 1 : -1;
  return (Number(m[3] ?? 4) + 1) * 12 + SEMITONE[m[1].toLowerCase()] + acc;
}

export const midiToSci = (midi: number) => `${LETTERS[midi % 12]}${Math.floor(midi / 12) - 1}`;
/** Nombre sin octava: "Fa♯" o "F♯". */
export const midiToName = (midi: number, n = notation) => NAMES[n][midi % 12];
export const midiToLabel = (midi: number, n = notation) =>
  `${midiToName(midi, n)}${Math.floor(midi / 12) - 1}`;
export const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const sciToLabel = (sci: string, n = notation) => {
  const midi = parseNote(sci);
  return midi === undefined ? sci : midiToLabel(midi, n);
};

/** "S: Fa4, A: Do4" o "Fa3 La3 Do4" -> grupos de notas en notación científica. */
export function parseStartNotes(text: string): StartNotes[] {
  return text
    .split(/[,;\n]/)
    .map((entry) => {
      const [head, tail] = entry.includes(':') ? entry.split(':') : ['', entry];
      const notes = tail
        .trim()
        .split(/\s+/)
        .map(parseNote)
        .filter((n) => n !== undefined)
        .map(midiToSci);
      return { label: head.trim() || undefined, notes };
    })
    .filter((g) => g.notes.length > 0);
}

export const formatStartNotes = (groups: StartNotes[] = [], n = notation) =>
  groups
    .map(
      (g) =>
        `${g.label ? `${g.label}: ` : ''}${g.notes.map((sci) => sciToLabel(sci, n)).join(' ')}`,
    )
    .join(', ');
