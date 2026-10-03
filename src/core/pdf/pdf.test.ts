import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from '../db/db';
import { importPdf, sha256, titleFromFilename } from './import';
import { LRU } from './lru';

const inspect = async () => ({ pageCount: 3, thumbnail: new Blob(['t']) });
const pdf = (text: string) => new Blob([text]);

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

test('sha256 conocido', async () => {
  expect(await sha256(new TextEncoder().encode('abc').buffer)).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('el título sale del nombre de archivo', () => {
  expect(titleFromFilename('Ave_verum_corpus.PDF')).toBe('Ave verum corpus');
});

test('reimportar el mismo PDF no duplica', async () => {
  expect(await importPdf(pdf('uno'), 'uno.pdf', inspect)).toBe('added');
  expect(await importPdf(pdf('uno'), 'otro nombre.pdf', inspect)).toBe('duplicate');
  expect(await importPdf(pdf('dos'), 'dos.pdf', inspect)).toBe('added');
  expect(await db.scores.count()).toBe(2);
  expect(await db.pdfs.count()).toBe(2);
  expect(await db.thumbnails.count()).toBe(2);
});

test('un PDF pendiente de un backup liviano se reengancha', async () => {
  await importPdf(pdf('uno'), 'uno.pdf', inspect);
  const row = (await db.pdfs.toArray())[0];
  await db.pdfs.put({ ...row, blob: undefined });
  expect(await importPdf(pdf('uno'), 'uno.pdf', inspect)).toBe('relinked');
  expect(await db.scores.count()).toBe(1);
  expect((await db.pdfs.get(row.id))!.blob).toBeDefined();
});

test('LRU desaloja el menos usado', () => {
  const evicted: number[] = [];
  const lru = new LRU<number>(2, (v) => evicted.push(v));
  lru.set('a', 1);
  lru.set('b', 2);
  lru.get('a');
  lru.set('c', 3);
  expect(evicted).toEqual([2]);
  expect(lru.get('a')).toBe(1);
  expect(lru.get('b')).toBeUndefined();
});
