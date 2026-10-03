import { db, newId } from '../db/db';
import { addScore } from '../db/repos';

export async function sha256(data: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const titleFromFilename = (name: string) =>
  name
    .replace(/\.pdf$/i, '')
    .replace(/[_]+/g, ' ')
    .trim() || name;

type Inspect = (data: ArrayBuffer) => Promise<{ pageCount: number; thumbnail: Blob | null }>;
const defaultInspect: Inspect = async (data) => (await import('./render')).inspectPdf(data);

export type ImportResult = 'added' | 'duplicate' | 'relinked' | 'error';

/**
 * Importa un PDF. Deduplica por SHA-256: si ya está, no crea otra partitura; si el PDF
 * estaba pendiente (backup liviano), lo reengancha.
 */
export async function importPdf(
  file: Blob,
  name: string,
  inspect: Inspect = defaultInspect,
): Promise<ImportResult> {
  try {
    const data = await file.arrayBuffer();
    const hash = await sha256(data);
    const existing = await db.pdfs.where('sha256').equals(hash).first();
    if (existing?.blob) return 'duplicate';

    // pdf.js transfiere el buffer al worker: se le pasa una copia.
    const { pageCount, thumbnail } = await inspect(data.slice(0));
    const blob = new Blob([data], { type: 'application/pdf' });
    const pdfId = existing?.id ?? newId();
    await db.pdfs.put({ id: pdfId, sha256: hash, blob, size: blob.size, pageCount });

    if (existing) {
      const scores = await db.scores.where('pdfId').equals(pdfId).toArray();
      if (thumbnail)
        await db.thumbnails.bulkPut(scores.map((s) => ({ scoreId: s.id, blob: thumbnail })));
      return 'relinked';
    }
    const score = await addScore({ pdfId, title: titleFromFilename(name) });
    if (thumbnail) await db.thumbnails.put({ scoreId: score.id, blob: thumbnail });
    return 'added';
  } catch (e) {
    console.error('No se pudo importar', name, e);
    return 'error';
  }
}

/** Importa de a uno para no trabar la UI; cada PDF cede el hilo entre pasos async. */
export async function importFiles(
  files: { blob: Blob; name: string }[],
  onProgress?: (done: number, total: number) => void,
) {
  const counts: Record<ImportResult, number> = { added: 0, duplicate: 0, relinked: 0, error: 0 };
  // Pedir storage persistente antes de guardar: en iOS baja el riesgo de desalojo.
  void navigator.storage?.persist?.();
  for (const [i, f] of files.entries()) {
    onProgress?.(i, files.length);
    counts[await importPdf(f.blob, f.name)]++;
  }
  onProgress?.(files.length, files.length);
  return counts;
}
