import { sciToLabel } from '../core/audio/notes';
import type { StartNotes } from '../core/db/types';
import { playStartNotes } from '../features/practice/PracticePanel';
import { Icon } from '../ui/Icon';
import { t } from './strings';

/**
 * Botón "Nota · Fa3" de la barra del lector: da el tono con las notas de inicio de la
 * partitura. Sin notas guardadas no aparece (se graban desde el teclado, en Ensayo).
 */
export function PlayStartNotes({ startNotes }: { startNotes?: StartNotes[] }) {
  const first = startNotes?.[0]?.notes[0];
  if (!first) return null;
  return (
    <button className="accent" onClick={() => playStartNotes(startNotes)}>
      <Icon name="note" size={26} />
      {t.reader.startNote} · {sciToLabel(first)}
    </button>
  );
}
