import { degrees, PDFDocument } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expect, test } from 'vitest';
import { shownWidth, toPdfSpace, type PageBox } from './pageSpace';

GlobalWorkerOptions.workerSrc = new URL(
  '../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).href;

// pdf.js es la referencia: es el que dibuja la página en pantalla, así que una anotación hecha
// en (u, v) tiene que caer en el mismo punto del PDF que pdf.js usó para ese lugar. Se arma un
// PDF con una página por rotación y la CropBox corrida del origen.
test('coincide con pdf.js en las cuatro rotaciones y con la CropBox corrida', async () => {
  const rotations = [0, 90, 180, 270];
  const crop = { x: 20, y: 35, width: 500, height: 700 };
  const doc = await PDFDocument.create();
  for (const r of rotations) {
    const page = doc.addPage([595, 842]);
    page.setCropBox(crop.x, crop.y, crop.width, crop.height);
    page.setRotation(degrees(r));
  }
  const pdf = await getDocument({ data: await doc.save() }).promise;
  for (const [i, rotation] of rotations.entries()) {
    const viewport = (await pdf.getPage(i + 1)).getViewport({ scale: 1 });
    const box: PageBox = { ...crop, rotation };
    expect(viewport.width).toBeCloseTo(shownWidth(box));
    for (const [u, v] of [
      [0, 0],
      [1, 1],
      [0.25, 0.7],
      [0.9, 0.1],
    ]) {
      const [px, py] = viewport.convertToPdfPoint(u * viewport.width, v * viewport.height);
      const [x, y] = toPdfSpace(box, u, v);
      expect([rotation, x, y].map((n) => Math.round(n * 1000))).toEqual(
        [rotation, px, py].map((n) => Math.round(n * 1000)),
      );
    }
  }
  await pdf.loadingTask.destroy();
});
