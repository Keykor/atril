import 'fake-indexeddb/auto';
import { afterEach, expect, test, vi } from 'vitest';
import { db } from '../db/db';
import { openPdf, PdfTimeoutError } from './render';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test('un PDF que no abre a tiempo no queda colgado: el siguiente intento empieza de cero', async () => {
  vi.useFakeTimers();
  const get = vi.spyOn(db.pdfData, 'get').mockReturnValue(new Promise(() => {}) as never);
  const first = openPdf('a');
  expect(openPdf('a')).toBe(first); // mientras abre, se reusa
  const failed = expect(first).rejects.toBeInstanceOf(PdfTimeoutError);
  await vi.advanceTimersByTimeAsync(20_000);
  await failed;
  const second = openPdf('a');
  expect(second).not.toBe(first);
  expect(get).toHaveBeenCalledTimes(2);
  second.catch(() => {});
});
