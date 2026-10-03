import Dexie from 'dexie';
import { getSetting, setSetting } from '../db/repos';
import { exportBackup } from './atril';
import { backupFileName, importFromFile, markBackedUp } from './files';

const CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID;
// drive.file: la app solo ve los archivos que ella misma creó. Scope no sensible.
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'Atril';
const DEBOUNCE_MS = 20_000;

export const driveConfigured = !!CLIENT_ID;

export interface DriveState {
  connected: boolean;
  lastUploadAt?: number;
  error?: 'auth' | 'upload'; // auth = hay que volver a tocar "Conectar"
}
export const getDriveState = () => getSetting<DriveState>('drive', { connected: false });
const patchState = async (patch: Partial<DriveState>) =>
  setSetting('drive', { ...(await getDriveState()), ...patch });

export class DriveAuthError extends Error {}

// --- Token ---
// ponytail: sin backend no hay refresh token. El access token dura ~1 h y renovarlo abre un
// popup de Google, que solo se permite desde un toque. Vencido, el backup automático se pausa
// y la UI pide reconectar. Backend con refresh tokens si esto molesta en el uso real.

interface TokenClient {
  requestAccessToken(opts?: { prompt?: string }): void;
}
interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(cfg: {
        client_id: string;
        scope: string;
        callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void;
        error_callback?: (e: unknown) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

let token: { value: string; expiresAt: number } | undefined;
let gis: Promise<Gis> | undefined;

const loadGis = () =>
  (gis ??= new Promise<Gis>((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => ok((window as unknown as { google: Gis }).google);
    s.onerror = () => {
      gis = undefined;
      fail(new Error('gsi'));
    };
    document.head.append(s);
  }));

/** Pide permiso a Google. Tiene que llamarse desde un toque del usuario. */
export async function connectDrive() {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID no está configurado');
  const g = await loadGis();
  await new Promise<void>((ok, fail) => {
    g.accounts.oauth2
      .initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (r) => {
          if (!r.access_token) return fail(new DriveAuthError(r.error));
          token = {
            value: r.access_token,
            expiresAt: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000,
          };
          ok();
        },
        error_callback: () => fail(new DriveAuthError('popup')),
      })
      .requestAccessToken({ prompt: '' });
  });
  await patchState({ connected: true, error: undefined });
}

export async function disconnectDrive() {
  if (token) (await loadGis()).accounts.oauth2.revoke(token.value);
  token = undefined;
  await setSetting('drive', { connected: false });
}

/** Solo para tests. */
export const setTokenForTests = (value: string) =>
  (token = { value, expiresAt: Date.now() + 3600_000 });

async function call(url: string, init: RequestInit = {}) {
  if (!token || token.expiresAt < Date.now()) throw new DriveAuthError('expired');
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token.value}` },
  });
  if (res.status === 401) {
    token = undefined;
    throw new DriveAuthError('401');
  }
  if (!res.ok) throw new Error(`Drive ${res.status}`);
  return res;
}

// --- Archivos ---

const q = (query: string, extra = '') =>
  `${API}/files?q=${encodeURIComponent(query)}&spaces=drive${extra}`;

async function folderId() {
  const found = await call(
    q(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`),
  ).then((r) => r.json());
  if (found.files?.[0]) return found.files[0].id as string;
  const created = await call(`${API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
  }).then((r) => r.json());
  return created.id as string;
}

export interface DriveBackup {
  id: string;
  name: string;
  modifiedTime: string;
}

export async function listDriveBackups(): Promise<DriveBackup[]> {
  const folder = await folderId();
  const res = await call(
    q(
      `'${folder}' in parents and trashed=false`,
      '&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)',
    ),
  ).then((r) => r.json());
  return res.files ?? [];
}

/** Sube el backup liviano. Un archivo por día: el del día se actualiza en el lugar. */
export async function uploadBackup(bytes: Uint8Array, name: string) {
  const folder = await folderId();
  const existing = await call(
    q(`'${folder}' in parents and name='${name}' and trashed=false`),
  ).then((r) => r.json());
  const body = new Blob([bytes as BlobPart], { type: 'application/zip' });
  if (existing.files?.[0]) {
    await call(`${UPLOAD}/files/${existing.files[0].id}?uploadType=media`, {
      method: 'PATCH',
      body,
    });
    return;
  }
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify({ name, parents: [folder] })], { type: 'application/json' }),
  );
  form.append('file', body);
  await call(`${UPLOAD}/files?uploadType=multipart`, { method: 'POST', body: form });
}

export async function restoreFromDrive(fileId: string) {
  const res = await call(`${API}/files/${fileId}?alt=media`);
  return importFromFile(await res.blob());
}

// --- Backup automático ---

export async function backupToDriveNow() {
  try {
    await uploadBackup(await exportBackup({ withPdfs: false }), backupFileName(true));
    await patchState({ lastUploadAt: Date.now(), error: undefined });
    await markBackedUp();
  } catch (e) {
    await patchState({ error: e instanceof DriveAuthError ? 'auth' : 'upload' });
    throw e;
  }
}

/** Después de cada cambio en los datos (con debounce) sube el backup liviano. */
export function startDriveSync() {
  if (!driveConfigured) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  Dexie.on('storagemutated', (parts) => {
    // Ajustes y miniaturas no son datos del backup (y el propio estado de Drive vive en ajustes).
    const relevant = Object.keys(parts).some(
      (k) => !/\/(settings|thumbnails|pdfData)(\/|$)/.test(k),
    );
    if (!relevant) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if ((await getDriveState()).connected) await backupToDriveNow().catch(() => {});
    }, DEBOUNCE_MS);
  });
}
