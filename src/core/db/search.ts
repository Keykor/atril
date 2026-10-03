import type { Score } from './types';

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
      ? (a, b) => a.title.localeCompare(b.title, 'es')
      : (a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt),
  );
}
