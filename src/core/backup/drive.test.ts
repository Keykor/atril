import 'fake-indexeddb/auto';
import { afterEach, expect, test, vi } from 'vitest';
import { DriveAuthError, listDriveBackups, setTokenForTests, uploadBackup } from './drive';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

test('la primera subida crea la carpeta y el archivo; la segunda actualiza el mismo archivo', async () => {
  const calls: { method: string; url: string }[] = [];
  let folder: string | undefined;
  let file: string | undefined;
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, url: decodeURIComponent(url) });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    if (method === 'GET' && url.includes('google-apps.folder'))
      return json({ files: folder ? [{ id: folder }] : [] });
    if (method === 'GET') return json({ files: file ? [{ id: file }] : [] });
    if (method === 'POST' && url.endsWith('/drive/v3/files')) return json({ id: (folder = 'F1') });
    if (method === 'POST') return json({ id: (file = 'B1') });
    return json({ id: file });
  });
  setTokenForTests('tok');

  await uploadBackup(new Uint8Array([1]), 'atril-liviano-2026-10-03.atril');
  expect(calls.map((c) => c.method)).toEqual(['GET', 'POST', 'GET', 'POST']);
  expect(calls[3].url).toContain('uploadType=multipart');

  calls.length = 0;
  await uploadBackup(new Uint8Array([2]), 'atril-liviano-2026-10-03.atril');
  expect(calls.map((c) => c.method)).toEqual(['GET', 'GET', 'PATCH']);
  expect(calls[2].url).toContain('/files/B1?uploadType=media');
});

test('un 401 pide reconectar', async () => {
  vi.stubGlobal('fetch', async () => json({}, 401));
  setTokenForTests('vencido');
  await expect(listDriveBackups()).rejects.toBeInstanceOf(DriveAuthError);
});
