import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from '../db/db';
import { addScore, addSetList, emptyAnnotations, saveAnnotations, updateScore } from '../db/repos';
import { importPdf } from '../pdf/import';
import { BackupFormatError, exportBackup, importBackup } from './atril';

const inspect = async () => ({ pageCount: 2, thumbnail: new ArrayBuffer(1) });
const clear = () => Promise.all(db.tables.map((t) => t.clear()));

async function seed() {
  await importPdf(new Blob(['pdf uno']), 'Locus iste.pdf', inspect);
  const score = (await db.scores.toArray())[0];
  await updateScore(score.id, { composer: 'A. Bruckner', bpm: 72 });
  await saveAnnotations({
    ...emptyAnnotations(score.id, 0),
    strokes: [{ id: 's', tool: 'pen', color: '#000', width: 0.004, points: [[0.1, 0.2, 0.5]] }],
  });
  const list = await addSetList('Concierto');
  await db.setlists.update(list.id, { items: [{ id: 'i', type: 'score', scoreId: score.id }] });
  await db.tags.add({ id: 't', name: 'Sacro', color: '#15803D' });
  return score;
}

const snapshot = async () => ({
  scores: await db.scores.toArray(),
  setlists: await db.setlists.toArray(),
  annotations: await db.annotations.toArray(),
  tags: await db.tags.toArray(),
  pdfs: await db.pdfs.toArray(),
  bytes: (await db.pdfData.toArray()).map((p) => new TextDecoder().decode(p.data)),
});

beforeEach(clear);

test('exportar e importar en un dispositivo vacío deja todo igual', async () => {
  await seed();
  const before = await snapshot();
  const backup = await exportBackup({ withPdfs: true });
  await clear();
  expect(await importBackup(backup)).toEqual({ scores: 1, pending: 0 });
  expect(await snapshot()).toEqual(before);
});

test('el backup liviano deja las partituras pendientes y se reenganchan al reimportar el PDF', async () => {
  const score = await seed();
  const light = await exportBackup({ withPdfs: false });
  const full = await exportBackup({ withPdfs: true });
  expect(light.length).toBeLessThan(full.length);

  await clear();
  expect(await importBackup(light)).toEqual({ scores: 1, pending: 1 });
  expect((await db.pdfs.toArray())[0].missing).toBe(true);
  expect(await db.annotations.count()).toBe(1);

  expect(await importPdf(new Blob(['pdf uno']), 'cualquier nombre.pdf', inspect)).toBe('relinked');
  expect(await db.scores.count()).toBe(1);
  expect((await db.scores.get(score.id))!.composer).toBe('A. Bruckner');
  expect((await db.pdfs.toArray())[0].missing).toBeUndefined();
});

test('al mezclar gana el updatedAt más nuevo y no se duplican PDFs', async () => {
  const score = await seed();
  const backup = await exportBackup({ withPdfs: true });

  await db.scores.update(score.id, { title: 'Más nuevo local', updatedAt: Date.now() + 1000 });
  await importBackup(backup);
  expect((await db.scores.get(score.id))!.title).toBe('Más nuevo local');

  await db.scores.update(score.id, { title: 'Viejo local', updatedAt: 1 });
  await importBackup(backup);
  expect((await db.scores.get(score.id))!.title).toBe('Locus iste');
  expect(await db.pdfs.count()).toBe(1);
});

test('el mismo PDF importado por separado en dos dispositivos se reusa por SHA-256', async () => {
  await seed();
  const backup = await exportBackup({ withPdfs: false });
  await clear();
  await importPdf(new Blob(['pdf uno']), 'Locus iste.pdf', inspect); // otro id local
  const localPdf = (await db.pdfs.toArray())[0];
  await addScore({ pdfId: localPdf.id, title: 'Otra' });

  expect((await importBackup(backup)).pending).toBe(0);
  expect(await db.pdfs.count()).toBe(1);
  expect((await db.scores.toArray()).every((s) => s.pdfId === localPdf.id)).toBe(true);
});

test('rechaza archivos que no son .atril', async () => {
  await expect(importBackup(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(BackupFormatError);
});
