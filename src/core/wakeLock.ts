/** Mantiene la pantalla encendida. El lock se pierde al ocultar la app: se re-pide al volver. */
export function keepAwake(): () => void {
  let lock: WakeLockSentinel | undefined;
  let released = false;
  const request = async () => {
    if (released || document.visibilityState !== 'visible') return;
    try {
      lock = await navigator.wakeLock?.request('screen');
    } catch {
      // Sin soporte o batería baja: no es un error para el usuario.
    }
  };
  void request();
  document.addEventListener('visibilitychange', request);
  return () => {
    released = true;
    document.removeEventListener('visibilitychange', request);
    void lock?.release();
  };
}
