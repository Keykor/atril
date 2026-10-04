import { useLiveQuery } from 'dexie-react-hooks';
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

/** Si la pista todavía no se vio en este dispositivo, y cómo darla por vista. */
export function useHint(id: HintId) {
  const seen = useLiveQuery(getHintsSeen, []);
  return { show: !!seen && !seen.includes(id), done: () => void markHintSeen(id) };
}

/** La tarjeta de una pista, si no se vio. La del lector es otra (TapZonesHint). */
export function PlaceHint({ id, when = true }: { id: Exclude<HintId, 'reader'>; when?: boolean }) {
  const hint = useHint(id);
  if (!when || !hint.show) return null;
  return <Hint {...t.hints[id]} doneLabel={t.hints.done} onDone={hint.done} />;
}
