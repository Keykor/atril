import { sciToLabel } from '../core/audio/notes';
import type { StartNotes } from '../core/db/types';
import { playStartNotes } from '../features/practice/PracticePanel';
import { Icon } from '../ui/Icon';
import { t } from './strings';

/** Botón "Nota · Fa3" de la barra del lector: toca las notas de inicio de la partitura. */
export function PlayStartNotes({ startNotes }: { startNotes?: StartNotes[] }) {
  const first = startNotes?.[0]?.notes[0];
  return (
    <button
      className="accent"
      disabled={!first}
      title={first ? undefined : t.practice.noStartNotes}
      onClick={() => playStartNotes(startNotes)}
    >
      <Icon name="note" size={26} />
      {first ? `${t.reader.startNote} · ${sciToLabel(first)}` : t.reader.startNote}
    </button>
  );
}
