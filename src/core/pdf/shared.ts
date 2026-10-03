const SHARED_CACHE = 'atril-shared'; // el mismo nombre que usa src/sw.ts

/** PDFs que llegaron por "Compartir" (Android) y esperan en la cache del service worker. */
export async function takeSharedFiles() {
  if (!('caches' in window) || !(await caches.has(SHARED_CACHE))) return [];
  const cache = await caches.open(SHARED_CACHE);
  const out: { blob: Blob; name: string }[] = [];
  for (const request of await cache.keys()) {
    const res = await cache.match(request);
    if (res)
      out.push({
        blob: await res.blob(),
        name: decodeURIComponent(res.headers.get('X-Name') ?? 'partitura.pdf'),
      });
  }
  await caches.delete(SHARED_CACHE);
  return out;
}
