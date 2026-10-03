# Instrucciones para Copilot

Atril es una PWA de lectura de partituras: React 19 + TypeScript + Vite, todo en el cliente
(pdf.js, IndexedDB con Dexie, Web Audio). Escribí los comentarios de review en español.

Antes de revisar, tené en cuenta `CLAUDE.md` y `docs/arquitectura.md`. En particular:

- **Arquitectura:** las pantallas (`src/app`, `src/features`, `src/ui`) leen datos con
  `useLiveQuery` sobre funciones de `src/core/db/queries.ts` y escriben con
  `src/core/db/repos.ts`. Importar `core/db/db`, `dexie` o `pdfjs-dist` desde la UI es un
  error de verdad: señalalo. ESLint ya lo bloquea.
- **pdfjs-dist 6:** `PDFDocumentProxy` expone `loadingTask` y no tiene `destroy()`; el patrón
  correcto es `doc.loadingTask.destroy()`. No sugieras `doc.destroy()`.
- **PDFs como `ArrayBuffer`** en IndexedDB a propósito (WebKit falla con `Blob`). No sugieras
  volver a `Blob`.
- **Coordenadas normalizadas:** anotaciones, marcadores y saltos guardan posiciones 0..1 y
  grosores como fracción del ancho de página, por página real del PDF. Un valor en píxeles
  guardado en la base es un bug.
- **Textos de interfaz** en `src/app/strings.ts`, en español rioplatense. Un texto suelto en un
  componente es un error.
- Prioridad del review: bugs que pierden datos (backup, migraciones, borrados), errores en
  Safari/iOS y problemas táctiles o de accesibilidad. Evitá sugerencias de estilo que Prettier
  ya resuelve.
