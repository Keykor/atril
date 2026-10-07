import { language } from '../language';
import type { Score, SetList } from './types';

// Sin acentos ni mayúsculas, para que "faure" encuentre "Fauré".
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface ScoreFilter {
  query?: string;
  tagId?: string;
  sort?: 'recent' | 'az';
}

// ponytail: filtro lineal en memoria; 300 partituras tardan <1 ms. Índice full-text si pasan de miles.
export function filterScores(scores: Score[], { query = '', tagId, sort = 'recent' }: ScoreFilter) {
  const q = normalize(query.trim());
  const out = scores.filter(
    (s) =>
      (!tagId || s.tagIds.includes(tagId)) &&
      (!q || normalize(s.title).includes(q) || normalize(s.composer ?? '').includes(q)),
  );
  return out.sort(
    sort === 'az'
      ? (a, b) => a.title.localeCompare(b.title, language)
      : (a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt),
  );
}

export interface SetListFilter {
  query?: string;
  tagId?: string;
  from?: string; // "YYYY-MM-DD", inclusive
  to?: string;
}

/**
 * Listas filtradas por nombre, etiqueta y rango de fechas. Orden: las próximas (desde `today`,
 * la más cercana primero), después las pasadas (la más reciente primero), al final sin fecha.
 * Las fechas son "YYYY-MM-DD": se comparan como texto.
 */
export function filterSetLists(
  lists: SetList[],
  { query = '', tagId, from, to }: SetListFilter,
  today: string,
) {
  const q = normalize(query.trim());
  const out = lists.filter(
    (l) =>
      (!tagId || !!l.tagIds?.includes(tagId)) &&
      (!q || normalize(l.name).includes(q)) &&
      (!from || (!!l.date && l.date >= from)) &&
      (!to || (!!l.date && l.date <= to)),
  );
  const rank = (l: SetList) => (!l.date ? 2 : l.date >= today ? 0 : 1);
  return out.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (rank(a) === 0 ? a.date!.localeCompare(b.date!) : 0) ||
      (rank(a) === 1 ? b.date!.localeCompare(a.date!) : 0) ||
      a.name.localeCompare(b.name, language),
  );
}
