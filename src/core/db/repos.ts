import { db, newId } from './db';

export { newId };
import {
  type Bookmark,
  type JumpLink,
  type PageAnnotations,
  type Score,
  type SetList,
  type Tag,
} from './types';

// --- Partituras ---

export async function addScore(data: Pick<Score, 'pdfId' | 'title'> & Partial<Score>) {
  const now = Date.now();
  const score: Score = {
    id: newId(),
    tagIds: [],
    lastPage: 0,
    createdAt: now,
    updatedAt: now,
    ...data,
  };
  await db.scores.add(score);
  return score;
}

export const updateScore = (id: string, patch: Partial<Score>) =>
  db.scores.update(id, { ...patch, updatedAt: Date.now() });

// Posición de lectura: no cuenta como edición, así un backup viejo no la pisa por updatedAt.
export const touchScore = (id: string, lastPage: number) =>
  db.scores.update(id, { lastPage, lastOpenedAt: Date.now() });

export function deleteScore(id: string) {
  return db.transaction('rw', db.tables, async () => {
    const score = await db.scores.get(id);
    if (!score) return;
    await db.scores.delete(id);
    await db.thumbnails.delete(id);
    await db.annotations.where('scoreId').equals(id).delete();
    await db.bookmarks.where('scoreId').equals(id).delete();
    await db.links.where('scoreId').equals(id).delete();
    if ((await db.scores.where('pdfId').equals(score.pdfId).count()) === 0) {
      await db.pdfs.delete(score.pdfId);
      await db.pdfData.delete(score.pdfId);
    }
    const now = Date.now();
    await db.setlists
      .filter((l) => l.items.some((i) => i.type === 'score' && i.scoreId === id))
      .modify((l) => {
        l.items = l.items.filter((i) => i.type !== 'score' || i.scoreId !== id);
        l.updatedAt = now;
      });
  });
}

// --- Etiquetas ---

export async function addTag(name: string, color: string) {
  const tag: Tag = { id: newId(), name, color };
  await db.tags.add(tag);
  return tag;
}

export const renameTag = (id: string, name: string) => db.tags.update(id, { name });

export function deleteTag(id: string) {
  return db.transaction('rw', db.tags, db.scores, async () => {
    await db.tags.delete(id);
    const now = Date.now();
    await db.scores
      .where('tagIds')
      .equals(id)
      .modify((s) => {
        s.tagIds = s.tagIds.filter((t) => t !== id);
        s.updatedAt = now;
      });
  });
}

// --- Anotaciones ---

export const annotationId = (scoreId: string, page: number) => `${scoreId}:${page}`;

export const emptyAnnotations = (scoreId: string, page: number): PageAnnotations => ({
  id: annotationId(scoreId, page),
  scoreId,
  page,
  strokes: [],
  texts: [],
  updatedAt: 0,
});

export const saveAnnotations = (a: PageAnnotations) =>
  db.annotations.put({ ...a, updatedAt: Date.now() });

// --- Listas ---

export async function addSetList(name: string) {
  const now = Date.now();
  const list: SetList = { id: newId(), name, items: [], createdAt: now, updatedAt: now };
  await db.setlists.add(list);
  return list;
}

export const updateSetList = (id: string, patch: Partial<SetList>) =>
  db.setlists.update(id, { ...patch, updatedAt: Date.now() });

export const deleteSetList = (id: string) => db.setlists.delete(id);

export async function duplicateSetList(id: string, suffix: string) {
  const src = await db.setlists.get(id);
  if (!src) return;
  const now = Date.now();
  const copy: SetList = {
    ...src,
    id: newId(),
    name: `${src.name} ${suffix}`,
    items: src.items.map((i) => ({ ...i, id: newId() })),
    createdAt: now,
    updatedAt: now,
  };
  await db.setlists.add(copy);
  return copy;
}

// --- Marcadores y saltos ---

export async function addBookmark(data: Omit<Bookmark, 'id'>) {
  await db.bookmarks.add({ id: newId(), ...data });
}
export async function addLink(data: Omit<JumpLink, 'id'>) {
  await db.links.add({ id: newId(), ...data });
}
export const deleteBookmark = (id: string) => db.bookmarks.delete(id);
export const deleteLink = (id: string) => db.links.delete(id);

// --- Ajustes ---

export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value });

/**
 * Primer arranque con pistas: solo las ve quien empieza de cero. Si ya hay partituras, la app
 * ya se venía usando y todas se dan por vistas.
 */
export const initHints = (all: string[]) =>
  db.transaction('rw', db.settings, db.scores, async () => {
    if (await db.settings.get('hintsSeen')) return;
    await setSetting('hintsSeen', (await db.scores.count()) ? all : []);
  });

export const markHintSeen = (id: string) =>
  db.transaction('rw', db.settings, async () => {
    const seen = ((await db.settings.get('hintsSeen'))?.value as string[] | undefined) ?? [];
    if (!seen.includes(id)) await setSetting('hintsSeen', [...seen, id]);
  });

export const resetHints = () => setSetting('hintsSeen', []);
