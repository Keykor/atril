/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// La versión nueva queda esperando hasta que el usuario toca "Actualizar" (core/update.ts manda
// SKIP_WAITING). Nunca se activa sola: una recarga en pleno concierto sería peor que una
// versión vieja.
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Web Share Target (Android): "Compartir > Atril" manda los PDFs por POST a ./share.
// Se dejan en una cache y la app los importa al abrir (ver core/pdf/shared.ts).
export const SHARED_CACHE = 'atril-shared';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || !url.pathname.endsWith('/share')) return;
  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const cache = await caches.open(SHARED_CACHE);
      let i = 0;
      for (const file of form.getAll('pdfs')) {
        if (!(file instanceof File)) continue;
        await cache.put(
          `shared/${Date.now()}-${i++}`,
          new Response(file, { headers: { 'X-Name': encodeURIComponent(file.name) } }),
        );
      }
      return Response.redirect('./', 303);
    })(),
  );
});
