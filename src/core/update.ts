import { registerSW } from 'virtual:pwa-register';

// Cada cuánto se pregunta si hay versión nueva con la app abierta (además de al volver a ella).
const CHECK_EVERY_MS = 60 * 60 * 1000;

let waiting = false;
let dismissed = false; // "Más tarde" oculta el aviso, no el botón de Ajustes
let registration: ServiceWorkerRegistration | undefined;
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
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      registration = reg;
      const check = () => {
        if (navigator.onLine) reg.update().catch(() => {});
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}

/** Hay una versión nueva descargada esperando (Ajustes la muestra aunque se haya dicho "Más tarde"). */
export const hasUpdate = () => waiting;
/** Para el aviso de arriba: hay versión nueva y no se dijo "Más tarde". */
export const showUpdateBanner = () => waiting && !dismissed;

/**
 * Busca versión nueva ya. true si hay una (descargada o bajándose: el aviso aparece cuando
 * termina), false si esta es la última, undefined si no se pudo preguntar (sin conexión).
 */
export async function checkForUpdate(): Promise<boolean | undefined> {
  if (waiting) return true;
  if (!registration || !navigator.onLine) return undefined;
  try {
    await registration.update();
  } catch {
    return undefined;
  }
  return !!(registration.installing || registration.waiting);
}

/** Activa la versión nueva y recarga la página. */
export const applyUpdate = () => apply?.(true);

/** "Más tarde": se oculta el aviso. Actualizar sigue en Ajustes → Versión. */
export function dismissUpdate() {
  dismissed = true;
  emit();
}

export const onUpdateChange = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
