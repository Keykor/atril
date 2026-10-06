/**
 * Entrega un archivo al usuario: por "Compartir" si el dispositivo lo permite (WhatsApp, mail,
 * imprimir, guardar en Archivos) y si no, como descarga. Devuelve false si canceló.
 */
export async function shareOrDownload(file: File, { share = true } = {}) {
  if (share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false; // el usuario canceló
      // Otro error (p. ej. el navegador no deja compartir ese tipo): se descarga.
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
