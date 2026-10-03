import { registerSW } from 'virtual:pwa-register';

// Cada cuánto se pregunta si hay versión nueva con la app abierta (además de al volver a ella).
const CHECK_EVERY_MS = 60 * 60 * 1000;

let waiting = false;
let apply: ((reload?: boolean) => Promise<void>) | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Registra el service worker. Cuando una versión nueva termina de descargarse queda esperando
 * (no se activa sola) y hasUpdate() pasa a true hasta que se aplica o se descarta.
 */
export function startUpdates() {
  if (!('serviceWorker' in navigator)) return;
  apply = registerSW({
    onNeedRefresh() {
      waiting = true;
      emit();
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}

export const hasUpdate = () => waiting;

/** Activa la versión nueva y recarga la página. */
export const applyUpdate = () => apply?.(true);

/** "Más tarde": se oculta el aviso; la versión nueva se usa la próxima vez que se abra la app. */
export function dismissUpdate() {
  waiting = false;
  emit();
}

export const onUpdateChange = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
