import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getHintsSeen } from '../core/db/queries';
import { markHintSeen } from '../core/db/repos';
import { Hint } from '../ui/Hint';
import { t } from './strings';

export const HINTS = [
  'reader',
  'annotate',
  'markers',
  'page',
  'practice',
  'lists',
  'library',
  'backup',
] as const;
export type HintId = (typeof HINTS)[number];
// Las que había en 0.7.0, antes de llevar la cuenta de las conocidas (ver initHints).
export const LEGACY_HINTS: HintId[] = ['reader', 'annotate', 'markers', 'lists'];

/**
 * Si la pista todavía no se vio en este dispositivo, y cómo darla por vista. Se cierra al
 * instante: no espera a que se guarde (en el celular la escritura puede quedar en cola detrás de
 * otra larga, como un backup, y parecía que "Entendido" no respondía).
 */
export function useHint(id: HintId) {
  const seen = useLiveQuery(getHintsSeen, []);
  const [closed, setClosed] = useState(false);
  return {
    show: !closed && !!seen && !seen.includes(id),
    done: () => {
      setClosed(true);
      void markHintSeen(id);
    },
  };
}

/** La tarjeta de una pista, si no se vio. La del lector es otra (TapZonesHint). */
export function PlaceHint({
  id,
  when = true,
  top,
}: {
  id: Exclude<HintId, 'reader'>;
  when?: boolean;
  top?: boolean;
}) {
  const hint = useHint(id);
  if (!when || !hint.show) return null;
  return <Hint {...t.hints[id]} doneLabel={t.hints.done} onDone={hint.done} top={top} />;
}
