import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import {
  addScore,
  addSetList,
  addTag,
  deleteScore,
  deleteTag,
  renameTag,
  duplicateSetList,
  emptyAnnotations,
  getGlobalReading,
  resolveReading,
  saveAnnotations,
  setSetting,
  updateSetList,
} from './repos';
import { filterScores } from './search';
import type { Score } from './types';

const pdf = (id: string) => ({ id, sha256: id, size: 1, pageCount: 2 });

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

test('sha256 es único en pdfs', async () => {
  await db.pdfs.add(pdf('a'));
  await expect(db.pdfs.add({ ...pdf('b'), sha256: 'a' })).rejects.toThrow();
});

test('borrar una partitura borra lo suyo y la saca de las listas', async () => {
  await db.pdfs.add(pdf('p'));
  const s = await addScore({ pdfId: 'p', title: 'Locus iste' });
  const other = await addScore({ pdfId: 'p', title: 'Copia' });
  await saveAnnotations(emptyAnnotations(s.id, 0));
  const list = await addSetList('Concierto');
  await updateSetList(list.id, {
    items: [
      { id: '1', type: 'score', scoreId: s.id },
      { id: '2', type: 'break', label: 'Intervalo' },
    ],
  });

  await deleteScore(s.id);
  expect(await db.annotations.count()).toBe(0);
  expect((await db.setlists.get(list.id))!.items).toHaveLength(1);
  expect(await db.pdfs.count()).toBe(1); // otra partitura todavía usa el PDF

  await deleteScore(other.id);
  expect(await db.pdfs.count()).toBe(0);
});

test('renombrar una etiqueta no la saca de las partituras', async () => {
  const tag = await addTag('Sacro', '#15803D');
  const s = await addScore({ pdfId: 'p', title: 'Ave verum', tagIds: [tag.id] });
  await renameTag(tag.id, 'Repertorio sacro');
  expect((await db.tags.get(tag.id))!.name).toBe('Repertorio sacro');
  expect((await db.scores.get(s.id))!.tagIds).toEqual([tag.id]);
});

test('borrar una etiqueta la saca de las partituras', async () => {
  const tag = await addTag('Sacro', '#15803D');
  const s = await addScore({ pdfId: 'p', title: 'Ave verum', tagIds: [tag.id] });
  await deleteTag(tag.id);
  expect((await db.scores.get(s.id))!.tagIds).toEqual([]);
});

test('duplicar una lista copia los ítems con ids nuevos', async () => {
  const list = await addSetList('Navidad');
  await updateSetList(list.id, { items: [{ id: '1', type: 'break', label: 'Intervalo' }] });
  const copy = await duplicateSetList(list.id, '(copia)');
  expect(copy!.name).toBe('Navidad (copia)');
  expect(copy!.items[0].id).not.toBe('1');
});

test('el ajuste de la partitura pisa al global', async () => {
  await setSetting('reading', { theme: 'sepia' });
  const global = await getGlobalReading();
  expect(global.theme).toBe('sepia');
  expect(resolveReading(global, { reading: { theme: 'dark' } } as Score).theme).toBe('dark');
  expect(resolveReading(global).mode).toBe('paged');
});

test('buscar entre 300 partituras responde en menos de 100 ms', () => {
  const scores: Score[] = Array.from({ length: 300 }, (_, i) => ({
    id: String(i),
    pdfId: 'p',
    title: i === 42 ? 'Cantique de Jean Racine' : `Obra ${i}`,
    composer: i === 42 ? 'G. Fauré' : 'Anónimo',
    tagIds: i % 2 ? ['t'] : [],
    lastPage: 0,
    createdAt: i,
    updatedAt: i,
  }));
  const t0 = performance.now();
  const found = filterScores(scores, { query: 'faure' });
  expect(performance.now() - t0).toBeLessThan(100);
  expect(found.map((s) => s.id)).toEqual(['42']);
  expect(filterScores(scores, { tagId: 't' })).toHaveLength(150);
  expect(filterScores(scores, { sort: 'az' })[0].title).toBe('Cantique de Jean Racine');
});
