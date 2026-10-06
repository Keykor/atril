import 'fake-indexeddb/auto';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expect, test } from 'vitest';
import type { PageAnnotations } from '../../core/db/types';
import { buildAnnotatedPdf, type FontSources } from './exportPdf';

GlobalWorkerOptions.workerSrc = new URL(
  '../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).href;

const file = (path: string) => async () => {
  const b = await readFile(path);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const fonts: FontSources = {
  bravura: file('node_modules/@vexflow-fonts/bravura/bravura.woff2'),
  caveat: file('node_modules/@fontsource/caveat/files/caveat-latin-700-normal.woff2'),
};
const original = file('tests/e2e/fixtures/Cancion_de_ejemplo.pdf');

const page = (n: number, extra: Partial<PageAnnotations>): PageAnnotations => ({
  id: `s:${n}`,
  scoreId: 's',
  page: n,
  strokes: [],
  texts: [],
  updatedAt: 0,
  ...extra,
});

test('el PDF exportado tiene las mismas páginas y dibuja lo anotado en su página', async () => {
  const out = await buildAnnotatedPdf(
    await original(),
    [
      page(0, {
        strokes: [
          {
            id: 'a',
            tool: 'pen',
            color: '#D7352B',
            width: 0.004,
            points: [
              [0.2, 0.3, 0.5],
              [0.5, 0.32, 0.5],
            ],
          },
          {
            id: 'b',
            tool: 'highlighter',
            color: '#FFD43B',
            width: 0.02,
            points: [
              [0.2, 0.5, 0.5],
              [0.6, 0.5, 0.5],
            ],
          },
        ],
        texts: [{ id: 't', x: 0.3, y: 0.6, text: 'respirar acá', color: '#2950C7', size: 0.03 }],
      }),
      page(2, {
        stamps: [{ id: 'm', symbol: 'dynamicMF', x: 0.4, y: 0.4, size: 0.04, color: '#000000' }],
      }),
      page(9, {
        texts: [{ id: 'x', x: 0.1, y: 0.1, text: 'fuera', color: '#000000', size: 0.03 }],
      }),
    ],
    fonts,
  );

  expect((await PDFDocument.load(out)).getPageCount()).toBe(3);
  // Lo anotado se dibuja como trazos vectoriales: cada página anotada tiene más rellenos que en
  // el original (el trazo, el resaltado y cada letra o símbolo son un relleno).
  const fills = async (data: Uint8Array | ArrayBuffer, n: number) => {
    const pdf = await getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
    const ops = await (await pdf.getPage(n)).getOperatorList();
    await pdf.loadingTask.destroy();
    // pdf.js 6 junta cada camino con su pintura: constructPath lleva la operación primero.
    const isFill = (op: number) => op === OPS.fill || op === OPS.eoFill;
    return ops.fnArray.filter(
      (op, i) => isFill(op) || (op === OPS.constructPath && isFill(ops.argsArray[i][0])),
    ).length;
  };
  const before = await original();
  expect(await fills(out, 1)).toBeGreaterThanOrEqual((await fills(before, 1)) + 3);
  expect(await fills(out, 2)).toBe(await fills(before, 2)); // sin anotaciones: igual
  expect(await fills(out, 3)).toBeGreaterThan(await fills(before, 3));
});

test('sin anotaciones devuelve el PDF tal cual y no carga fuentes', async () => {
  const fail = () => Promise.reject(new Error('no debería cargar fuentes'));
  const out = await buildAnnotatedPdf(await original(), [], { bravura: fail, caveat: fail });
  expect((await PDFDocument.load(out)).getPageCount()).toBe(3);
});
