import { useLiveQuery } from 'dexie-react-hooks';
import { getHintsSeen } from '../core/db/queries';
import { markHintSeen } from '../core/db/repos';

export const HINTS = ['reader', 'annotate', 'markers', 'lists'] as const;
export type HintId = (typeof HINTS)[number];

/** Si la pista todavía no se vio en este dispositivo, y cómo darla por vista. */
export function useHint(id: HintId) {
  const seen = useLiveQuery(getHintsSeen, []);
  return { show: !!seen && !seen.includes(id), done: () => void markHintSeen(id) };
}

export const helpHref = (section: string) => `#/help/${section}`;
