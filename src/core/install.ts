interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

let deferred: InstallPromptEvent | undefined;
const listeners = new Set<() => void>();

// Chrome/Android avisa cuando la app se puede instalar; se guarda para ofrecer el botón.
window.addEventListener?.('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  listeners.forEach((l) => l());
});
window.addEventListener?.('appinstalled', () => {
  deferred = undefined;
  listeners.forEach((l) => l());
});

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true;

// iPadOS se presenta como Mac: se distingue por el soporte táctil.
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const canPromptInstall = () => !!deferred;
export const promptInstall = () => deferred?.prompt();
export const onInstallChange = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
