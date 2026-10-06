import { getSetting } from '../db/queries';
import { setSetting } from '../db/repos';
import { regenerateThumbnails } from '../pdf/import';
import { shareOrDownload } from '../share';
import { exportBackup, importBackup } from './atril';

const WEEK = 7 * 24 * 60 * 60 * 1000;

export const backupFileName = (light: boolean, date = new Date()) =>
  `atril-${light ? 'liviano-' : ''}${date.toISOString().slice(0, 10)}.atril`;

/** ¿Toca recordar el backup? Pasaron 7 días desde el último (o desde que hay algo que perder). */
export const backupDue = (now: number, lastBackupAt?: number, firstDataAt?: number) =>
  firstDataAt !== undefined && now - (lastBackupAt ?? firstDataAt) > WEEK;

export const getLastBackupAt = () => getSetting<number | undefined>('lastBackupAt', undefined);
export const markBackedUp = () => setSetting('lastBackupAt', Date.now());

/** Exporta y entrega el archivo: el liviano por "Compartir" si se puede (WhatsApp, Drive). */
export async function exportToFile(light: boolean) {
  const bytes = await exportBackup({ withPdfs: !light });
  const name = backupFileName(light);
  const file = new File([bytes as BlobPart], name, { type: 'application/zip' });
  if (!(await shareOrDownload(file, { share: light }))) return false;
  await markBackedUp();
  return true;
}

export async function importFromFile(file: Blob) {
  const summary = await importBackup(new Uint8Array(await file.arrayBuffer()));
  void regenerateThumbnails();
  return summary;
}
