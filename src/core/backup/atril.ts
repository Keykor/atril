import { strFromU8, strToU8, unzip, zip, type Unzipped, type Zippable } from 'fflate';
import { db } from '../db/db';
import type { PdfFile } from '../db/types';

export const BACKUP_VERSION = 1;
// Ajustes que viajan en el backup. El resto (estado de Drive) es de cada dispositivo.
const SHARED_SETTINGS = ['reading'];

const json = (value: unknown) => strToU8(JSON.stringify(value));
const zipAsync = (files: Zippable) =>
  new Promise<Uint8Array>((ok, fail) => zip(files, (err, out) => (err ? fail(err) : ok(out))));
const unzipAsync = (data: Uint8Array) =>
  new Promise<Unzipped>((ok, fail) => unzip(data, (err, out) => (err ? fail(err) : ok(out))));

/**
 * Exporta todo como .atril (un zip). Sin PDFs es el backup liviano: lleva pdfs.json con
 * id y SHA-256 para reenganchar cada partitura con su PDF al importar.
 */
// ponytail: arma el zip entero en memoria. Pasar a streaming si las bibliotecas superan
// unos cientos de MB.
export async function exportBackup({ withPdfs }: { withPdfs: boolean }) {
  const files: Zippable = {
    'manifest.json': json({
      format: 'atril',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      app: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
    }),
    'scores.json': json(await db.scores.toArray()),
    'tags.json': json(await db.tags.toArray()),
    'setlists.json': json(await db.setlists.toArray()),
    'annotations.json': json(await db.annotations.toArray()),
    'bookmarks.json': json(await db.bookmarks.toArray()),
    'links.json': json(await db.links.toArray()),
    'settings.json': json(await db.settings.where('key').anyOf(SHARED_SETTINGS).toArray()),
    'pdfs.json': json(await db.pdfs.toArray()),
  };
  if (withPdfs) {
    const pdfs = await db.pdfs.toArray();
    for (const pdf of pdfs) {
      const row = await db.pdfData.get(pdf.id);
      // Los PDF ya vienen comprimidos: se guardan sin recomprimir.
      if (row) files[`pdfs/${pdf.sha256}.pdf`] = [new Uint8Array(row.data), { level: 0 }];
    }
  }
  return zipAsync(files);
}

export interface ImportSummary {
  scores: number; // partituras nuevas o actualizadas
  pending: number; // partituras cuyo PDF hay que reimportar
}

export class BackupFormatError extends Error {}

/**
 * Importa un .atril mezclando por id. Si el SHA-256 ya existe se reusa el PDF local.
 * Ante conflicto gana el updatedAt más nuevo.
 */
export async function importBackup(data: Uint8Array): Promise<ImportSummary> {
  let zipped: Unzipped;
  try {
    zipped = await unzipAsync(data);
  } catch {
    throw new BackupFormatError('zip');
  }
  const read = <T>(name: string): T[] =>
    zipped[name] ? (JSON.parse(strFromU8(zipped[name])) as T[]) : [];
  const manifest = zipped['manifest.json'] && JSON.parse(strFromU8(zipped['manifest.json']));
  if (manifest?.format !== 'atril' || !(manifest.version <= BACKUP_VERSION))
    throw new BackupFormatError('manifest');

  const summary: ImportSummary = { scores: 0, pending: 0 };

  await db.transaction('rw', db.tables, async () => {
    // PDFs: el id remoto se traduce al local cuando el mismo archivo ya está acá.
    const pdfId = new Map<string, string>();
    for (const remote of read<PdfFile>('pdfs.json')) {
      const bytes = zipped[`pdfs/${remote.sha256}.pdf`];
      const local = await db.pdfs.where('sha256').equals(remote.sha256).first();
      const id = local?.id ?? remote.id;
      pdfId.set(remote.id, id);
      const hasData = !!local && !local.missing;
      if (bytes && !hasData) {
        // slice(): copia propia, sin retener el buffer del zip entero.
        await db.pdfData.put({ id, data: bytes.slice().buffer as ArrayBuffer });
        await db.pdfs.put({ ...remote, id, missing: undefined });
      } else if (!local) {
        await db.pdfs.put({ ...remote, id, missing: true });
      }
    }

    const newer = async <T extends { id: string; updatedAt: number }>(
      table: { get(id: string): Promise<T | undefined>; put(row: T): Promise<unknown> },
      rows: T[],
    ) => {
      let n = 0;
      for (const row of rows) {
        const local = await table.get(row.id);
        if (local && local.updatedAt >= row.updatedAt) continue;
        await table.put(row);
        n++;
      }
      return n;
    };

    const scores = read<import('../db/types').Score>('scores.json').map((s) => ({
      ...s,
      pdfId: pdfId.get(s.pdfId) ?? s.pdfId,
    }));
    summary.scores = await newer(db.scores, scores);
    await newer(db.setlists, read('setlists.json'));
    await newer(db.annotations, read('annotations.json'));
    // Sin updatedAt: lo que trae el backup pisa por id.
    await db.tags.bulkPut(read('tags.json'));
    await db.bookmarks.bulkPut(read('bookmarks.json'));
    await db.links.bulkPut(read('links.json'));
    for (const s of read<{ key: string; value: unknown }>('settings.json'))
      if (SHARED_SETTINGS.includes(s.key) && !(await db.settings.get(s.key)))
        await db.settings.put(s);

    const missing = new Set(await db.pdfs.filter((p) => !!p.missing).primaryKeys());
    summary.pending = await db.scores.filter((s) => missing.has(s.pdfId)).count();
  });
  return summary;
}
