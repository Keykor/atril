# Arquitectura de Atril

Atril es una PWA que corre entera en el navegador: React 19 + TypeScript sobre Vite, pdf.js para
renderizar, IndexedDB (con Dexie) para guardar y Web Audio para el sonido. No hay backend; el
único servicio externo es Google Drive, opcional, para el backup.

## Capas

```
src/
  app/        Shell, router por hash, pantallas que componen features, strings.ts, tokens.css
  features/   Una carpeta por funcionalidad: library, reader, annotations, setlists,
              practice, settings. Componentes de React.
  core/       Todo lo que toca APIs del navegador: db (Dexie), pdf (pdf.js), backup (.atril y
              Drive), audio (Web Audio), wakeLock, install.
  ui/         Componentes compartidos sin lógica de dominio (Icon, Sheet, controles).
  sw.ts       Service worker: precache, Web Share Target y espera de versiones nuevas.
```

Reglas de dependencia, que hace cumplir ESLint (`no-restricted-imports` en `eslint.config.js`):

- `app/`, `features/` y `ui/` **no importan** `core/db/db`, `dexie` ni `pdfjs-dist`.
- Una feature **no importa de otra feature**. Si una pantalla necesita dos features, se compone
  en `src/app/` (por ejemplo `ScoreScreen.tsx` junta lector, anotaciones, marcadores, listas y
  ensayo).
- `core/` **no importa** de `app/`, `features/` ni `ui/`.

### Cómo leen y escriben datos las pantallas

- **Leer:** con `useLiveQuery(() => consulta(...))`, usando funciones de `core/db/queries.ts`.
  `useLiveQuery` vuelve a ejecutar la consulta cuando cambian las tablas que lee, así que la
  pantalla se actualiza sola, venga el cambio de donde venga (otra pantalla, un backup
  importado). Toda lectura de la base vive en `queries.ts`, incluidos los ajustes
  (`getSetting`, `getGlobalReading`). Los módulos de `core` que tienen estado propio exponen
  una lectura con nombre de dominio construida sobre esas (`getDriveState` en
  `core/backup/drive.ts`, `getLastBackupAt` en `core/backup/files.ts`).
- **Escribir:** con funciones de `core/db/repos.ts`. Ahí viven las reglas que tienen que
  cumplirse siempre: borrar en cascada, actualizar `updatedAt`, sacar una partitura de las
  listas cuando se borra.

No hay store global (ni Zustand ni Redux): lo que está en la base sale de `useLiveQuery` y lo que
es de una pantalla (barras visibles, herramienta activa) es `useState`.

## Modelo de datos

La fuente de verdad es `src/core/db/types.ts` (tipos) y `src/core/db/db.ts` (tablas e índices).
Resumen:

| Tabla         | Qué guarda                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pdfs`        | Metadatos de cada PDF: SHA-256, tamaño, páginas, `missing` si falta el archivo                                                     |
| `pdfData`     | Los bytes del PDF (`ArrayBuffer`), con el mismo id que en `pdfs`                                                                   |
| `thumbnails`  | Miniatura JPEG de la primera página, por partitura                                                                                 |
| `scores`      | Partituras: título, compositor, etiquetas, BPM, notas de inicio, ajustes de lectura propios, recorte, orden virtual, última página |
| `tags`        | Etiquetas con color                                                                                                                |
| `annotations` | Trazos y textos por página real del PDF (`${scoreId}:${page}`)                                                                     |
| `setlists`    | Listas: ítems de tipo partitura o separador                                                                                        |
| `bookmarks`   | Marcadores: página real y punto (`x`, `y` de 0 a 1)                                                                                |
| `links`       | Saltos: de un punto a una página (o al punto de un marcador)                                                                       |
| `settings`    | Clave/valor: ajustes de lectura globales, "solo el lápiz dibuja", estado de Drive                                                  |

Convenciones del modelo:

- **Coordenadas normalizadas.** Todo lo que se dibuja sobre una página (trazos, textos,
  marcadores, saltos) guarda posiciones de 0 a 1 y grosores como fracción del ancho de página.
  Así se ve igual en cualquier pantalla, con zoom o con recorte.
- **Página real, no posición.** Anotaciones y marcadores apuntan a la página real del PDF (base
  0). El orden virtual (`pageOrder`, por ejemplo 1, 2, 3, 2, 3) solo cambia qué se muestra; si se
  repite una página, sus anotaciones aparecen en cada repetición.
- **Migraciones.** Un cambio de esquema es una nueva `db.version(n)` con su migración. Nunca se
  borra la base. Un campo opcional sin índice no necesita versión nueva.

## Backup: el formato `.atril`

Un zip con un JSON por tabla (`scores.json`, `tags.json`, `setlists.json`, `annotations.json`,
`bookmarks.json`, `links.json`, `settings.json`, `pdfs.json`), un `manifest.json` con la versión
del formato y los PDFs en `pdfs/<sha256>.pdf`.

- **Backup liviano:** el mismo zip sin la carpeta `pdfs/`. Pesa poco (es el que se sube a Drive
  y se manda por WhatsApp). Al importarlo, cada partitura cuyo PDF no está en el dispositivo
  queda marcada como `missing` y se reengancha sola cuando se reimporta ese PDF (se reconoce por
  SHA-256).
- **Mezcla al importar:** por id; ante conflicto gana el `updatedAt` más nuevo. La posición de
  lectura no cuenta como edición, para que un backup viejo no la pise.
- Las miniaturas y el ajuste "solo el lápiz dibuja" no viajan: son de cada dispositivo.

## Render de PDFs

`core/pdf/render.ts` renderiza con pdf.js en un worker y cachea las últimas 5 páginas como
`ImageBitmap`. Cada página en pantalla copia el bitmap a su propio `<canvas>`, así la misma
página puede mostrarse en dos lugares a la vez (orden virtual con repeticiones). Los canvas que
salen de pantalla se achican a 1×1 para liberar memoria al instante, porque Safari corta el
render cuando la memoria total de canvas pasa los ~384 MB.

## Decisiones y por qué

| Decisión                                        | Por qué                                                                                                                          | Alternativa descartada                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| PWA en vez de app nativa                        | Se instala desde un link, sin tiendas ni cuentas de desarrollador pagas; una actualización llega a todos al publicar             | Capacitor o Flutter: USD 99/año para iOS y builds que vencen         |
| Bytes de PDF como `ArrayBuffer` en tabla aparte | WebKit falla al guardar `Blob` en IndexedDB en algunos contextos; además las consultas de metadatos no cargan los PDFs           | `Blob` dentro de la misma fila                                       |
| Consultas en `core/db/queries.ts`               | Una sola fuente de verdad para cada consulta, testeable sin pantalla, y una regla de lint que la hace cumplir                    | Consultas dentro de cada pantalla                                    |
| Router por hash (`#/score/…`)                   | Funciona en GitHub Pages sin configurar fallback, y el botón atrás de Android anda                                               | Librería de rutas                                                    |
| CSS plano con variables                         | Cinco pantallas no justifican un framework de estilos                                                                            | Tailwind u otro                                                      |
| Fuentes empaquetadas con `@fontsource`          | Google Fonts por CDN rompe el modo sin conexión                                                                                  | CDN                                                                  |
| Orden de páginas como texto ("1, 2, 3, 2")      | Las miniaturas de partituras casi no se distinguen y el texto deja repetir páginas fácil                                         | Arrastrar miniaturas                                                 |
| Drive sin backend                               | Sin servidor que mantener; el scope `drive.file` solo ve los archivos que crea Atril                                             | Backend con refresh tokens (el token dura ~1 h y hay que reconectar) |
| Versión nueva con aviso, no automática          | La versión nueva se descarga sola pero espera a que el usuario toque "Actualizar": recargar sola podría pasar en pleno concierto | Activarla apenas se descarga (`skipWaiting` al instalar)             |

Una decisión de arquitectura nueva se agrega a esta tabla en el mismo PR que la introduce. La
discusión completa queda en la descripción de ese PR.

## Particularidades de iOS que el código cubre

- Safari puede borrar IndexedDB si le falta espacio: se pide `navigator.storage.persist()`, hay
  recordatorio de backup y backup en Drive. La app instalada no comparte datos con Safari.
- Web Audio queda mudo con el switch de silencio salvo que se setee
  `navigator.audioSession.type = "playback"` antes de crear el `AudioContext`
  (`core/audio/engine.ts`).
- Wake Lock se pierde al minimizar la app: se vuelve a pedir en cada `visibilitychange`.
- Web Share Target no existe en iOS: ahí se importa desde el selector de archivos.
