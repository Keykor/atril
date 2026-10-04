// Lecturas de la base para las pantallas. Se usan dentro de useLiveQuery, que vuelve a
// ejecutarlas sola cuando cambian las tablas que tocan: la reactividad no depende de que la
// consulta viva en la pantalla. Las escrituras están en repos.ts.
import { db } from './db';
import { emptyAnnotations, annotationId } from './repos';
import {
  defaultReading,
  type Bookmark,
  type JumpLink,
  type ReadingPrefs,
  type Score,
  type SetList,
  type Tag,
} from './types';

const byName = <T extends { name: string }>(rows: T[]) =>
  rows.sort((a, b) => a.name.localeCompare(b.name, 'es'));

// --- Partituras ---

/** null = no existe (undefined queda para "todavía cargando" en useLiveQuery). */
export const getScore = async (id: string): Promise<Score | null> =>
  (await db.scores.get(id)) ?? null;

export const listScores = () => db.scores.toArray();

export const getThumbnail = async (scoreId: string) => (await db.thumbnails.get(scoreId))?.data;

/** PDFs que vinieron de un backup liviano y hay que reimportar. */
export const missingPdfIds = async () =>
  new Set(await db.pdfs.filter((p) => !!p.missing).primaryKeys());

/** Cuándo se cargó la primera partitura: desde ahí corre el recordatorio de backup. */
export async function firstDataAt() {
  let first: number | undefined;
  await db.scores.each((s) => {
    if (first === undefined || s.createdAt < first) first = s.createdAt;
  });
  return first;
}

// --- Etiquetas ---

export const listTags = async (): Promise<Tag[]> => byName(await db.tags.toArray());

// --- Anotaciones ---

export const getPageAnnotations = async (scoreId: string, page: number) =>
  (await db.annotations.get(annotationId(scoreId, page))) ?? emptyAnnotations(scoreId, page);

// --- Marcadores y saltos ---

export interface ScoreMarkers {
  bookmarks: Bookmark[]; // en orden de lectura: página y después altura
  links: JumpLink[];
}

export async function getScoreMarkers(scoreId: string): Promise<ScoreMarkers> {
  const [bookmarks, links] = await Promise.all([
    db.bookmarks.where('scoreId').equals(scoreId).toArray(),
    db.links.where('scoreId').equals(scoreId).toArray(),
  ]);
  return { bookmarks: bookmarks.sort((a, b) => a.page - b.page || a.y - b.y), links };
}

// --- Listas ---

export const listSetLists = async (): Promise<SetList[]> => byName(await db.setlists.toArray());

export const getSetList = async (id: string): Promise<SetList | null> =>
  (await db.setlists.get(id)) ?? null;

// --- Ajustes ---

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  return ((await db.settings.get(key))?.value as T | undefined) ?? fallback;
}

/** Pistas del tutorial ya vistas en este dispositivo (no viajan en el backup). */
export const getHintsSeen = () => getSetting<string[] | null>('hintsSeen', null);

export const getGlobalReading = async (): Promise<ReadingPrefs> => ({
  ...defaultReading,
  ...(await getSetting<Partial<ReadingPrefs>>('reading', {})),
});

/** Ajustes de lectura efectivos: los globales pisados por los de la partitura. */
export const resolveReading = (global: ReadingPrefs, score?: Score): ReadingPrefs => ({
  ...global,
  ...score?.reading,
});
