import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { db } from '../db/db';
import { LRU } from './lru';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PIXEL_WIDTH = 2400; // techo para PDFs escaneados enormes y zoom alto
// Si pdf.js no contesta en este tiempo (p. ej. el sistema cortó el worker con la app en segundo
// plano), se descarta el documento y se puede reintentar, en vez de quedar "Abriendo…" para
// siempre. ponytail: tiempo fijo; un PDF escaneado enorme en un equipo lento podría pasarlo.
const TIMEOUT_MS = 20_000;

// Un documento abierto por vez alcanza (el lector muestra una partitura); el anterior se destruye.
// ponytail: las miniaturas de importación también pasan por acá, de a una.
let current:
  | { id: string; doc: Promise<pdfjs.PDFDocumentProxy>; task?: pdfjs.PDFDocumentLoadingTask }
  | undefined;

export class MissingPdfError extends Error {}
export class PdfTimeoutError extends Error {}

/** Rechaza si `promise` no termina a tiempo; ahí descarta el documento abierto y sus caches. */
export function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, fail) => {
    timer = setTimeout(() => {
      closePdf();
      fail(new PdfTimeoutError());
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function closePdf() {
  current?.task?.destroy().catch(() => {});
  current = undefined;
  pages.clear();
  thumbs.clear();
}

export function openPdf(pdfId: string) {
  if (current?.id === pdfId) return current.doc;
  closePdf();
  const entry: NonNullable<typeof current> = { id: pdfId, doc: undefined! };
  entry.doc = withTimeout(
    db.pdfData.get(pdfId).then((pdf) => {
      if (!pdf) throw new MissingPdfError(pdfId);
      if (current !== entry) throw new PdfTimeoutError(); // ya se descartó
      entry.task = pdfjs.getDocument({ data: pdf.data });
      return entry.task.promise;
    }),
  );
  current = entry;
  entry.doc.catch(() => {
    if (current === entry) current = undefined;
  });
  return entry.doc;
}

// La cache guarda ImageBitmaps, no elementos canvas: cada vista dibuja su propia copia, así
// la misma página puede estar en dos lugares a la vez (orden virtual con repeticiones).
// Safari corta el render si la memoria total de canvas pasa ~384 MB: cache chica, y el canvas
// de render se achica a 1×1 apenas se saca el bitmap.
const pages = new LRU<Promise<ImageBitmap>>(5, (p) => p.then((b) => b.close()).catch(() => {}));

async function draw(doc: pdfjs.PDFDocumentProxy, page: number, pixelWidth: number) {
  const p = await doc.getPage(page + 1);
  const base = p.getViewport({ scale: 1 });
  const viewport = p.getViewport({ scale: Math.min(pixelWidth, MAX_PIXEL_WIDTH) / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await p.render({ canvas, viewport }).promise;
  return canvas;
}

/**
 * Página renderizada al ancho CSS pedido (por devicePixelRatio). Cacheada.
 * El bitmap es de la cache: hay que copiarlo (drawImage) enseguida, puede cerrarse al desalojar.
 */
export function renderPage(pdfId: string, page: number, cssWidth: number) {
  const pixelWidth = Math.round(cssWidth * Math.min(window.devicePixelRatio || 1, 2));
  const key = `${pdfId}:${page}:${pixelWidth}`;
  let hit = pages.get(key);
  if (!hit) {
    const p = withTimeout(
      openPdf(pdfId).then(async (doc) => {
        const canvas = await draw(doc, page, pixelWidth);
        const bitmap = await createImageBitmap(canvas);
        canvas.width = canvas.height = 1;
        return bitmap;
      }),
    );
    // Un render fallido no queda en la cache: el próximo pedido lo vuelve a intentar.
    p.catch(() => pages.get(key) === p && pages.delete(key));
    pages.set(key, p);
    hit = p;
  }
  return hit;
}

const thumbs = new Map<string, Promise<string>>();

/** Miniatura chica de una página como data URL. No pasa por la LRU del lector. */
export function renderThumb(pdfId: string, page: number, pixelWidth = 112) {
  const key = `${pdfId}:${page}`;
  let hit = thumbs.get(key);
  if (!hit) {
    hit = openPdf(pdfId).then(async (doc) => {
      const canvas = await draw(doc, page, pixelWidth);
      const url = canvas.toDataURL('image/jpeg', 0.7);
      canvas.width = canvas.height = 1;
      return url;
    });
    thumbs.set(key, hit);
  }
  return hit;
}

/** Tamaño de cada página a escala 1 (para reservar el espacio antes de renderizar). */
export function pageSizes(pdfId: string) {
  return withTimeout(
    openPdf(pdfId).then(async (doc) => {
      const out: { w: number; h: number }[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const v = (await doc.getPage(i)).getViewport({ scale: 1 });
        out.push({ w: v.width, h: v.height });
      }
      return out;
    }),
  );
}

/** Cantidad de páginas y miniatura de la primera, sin pasar por la cache del lector. */
export async function inspectPdf(data: ArrayBuffer) {
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const canvas = await draw(doc, 0, 300);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
    canvas.width = canvas.height = 1;
    return { pageCount: doc.numPages, thumbnail: (await blob?.arrayBuffer()) ?? null };
  } finally {
    await doc.loadingTask.destroy();
  }
}

/** Recorte automático: caja de lo que no es blanco en una página, como fracciones 0..1. */
export async function detectCrop(pdfId: string, page: number) {
  const doc = await openPdf(pdfId);
  const canvas = await draw(doc, page, 200);
  const { width: w, height: h } = canvas;
  const px = canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  let top = h,
    left = w,
    right = 0,
    bottom = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i] + px[i + 1] + px[i + 2] < 600) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  canvas.width = canvas.height = 1;
  if (right <= left || bottom <= top) return undefined;
  const pad = 0.015; // un poco de aire alrededor de la música
  return {
    top: Math.max(0, top / h - pad),
    left: Math.max(0, left / w - pad),
    right: Math.max(0, 1 - (right + 1) / w - pad),
    bottom: Math.max(0, 1 - (bottom + 1) / h - pad),
  };
}
