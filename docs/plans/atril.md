# Atril — plan de implementación

Nombre del archivo: slug del proyecto (`atril`), no hay ticket.

Fuentes:

- Plan original: https://claude.ai/artifact/TwaJ7HPF3f8ZL82a3DZEs3 ("Atril — plan de la app de partituras")
- Diseños de referencia: https://claude.ai/artifact/KSW31eo6imuvVZMqExsXsa ("Atril — pantallas", 11 artboards)

Este archivo manda sobre el plan original donde difieren (ver "Qué cambió respecto del plan original").

## Problema

Quiero un lector de partituras liviano para tablet y celular, pensado para coro, banda, cifrados
y estudio. Que haga pocas cosas y las haga bien: abrir PDFs, leerlos cómodo, anotarlos con lápiz
o dedo, armar listas de partituras con nombre y orden, y dar dos herramientas de ensayo
(metrónomo y un teclado para dar notas). Tiene que andar en Android y en iOS, 100 % offline, y
poder pasársela a compañeros con un link, sin tiendas pagas.

## Alcance

Incluye (fase 1 + fase 2 del plan original, todo en un solo PR):

- Importar PDFs (selector múltiple, Web Share Target en Android), deduplicado por SHA-256
- Biblioteca: grilla, búsqueda, etiquetas con color, orden, edición de metadatos
- Lector: paginado, vertical, dos páginas, zonas de toque, swipe como hoja, barras que se
  ocultan, temas claro/sepia/oscuro, Wake Lock, última página por partitura
- Ajustes de lectura globales y por partitura
- Anotaciones: lápiz, resaltador, texto, goma por trazo, deshacer/rehacer, "solo el lápiz dibuja"
- Listas: nombre, notas, reordenar, separadores, duplicar, modo show
- Backup `.atril` completo y liviano, recordatorio a los 7 días, `storage.persist()`
- Backup en Drive (implementado; el client ID de OAuth entra por variable de entorno)
- Metrónomo, teclado de dos octavas, botón de notas de inicio
- Lectura avanzada: media página, saltos, recorte de márgenes, orden virtual de páginas,
  marcadores, autoscroll, teclas y pedal
- PWA instalable, offline, guía de "Agregar a inicio" en iOS, deploy a GitHub Pages

NO incluye (fase 3 del plan original):

- Exportar PDF anotado aplanado (no se instala `pdf-lib`)
- Compartir una lista como paquete, audios de ensayo, ChordPro, afinador
- Capacitor, efecto de hoja doblándose
- Cuentas, sync entre personas, OMR, reproducción de la partitura
- Interfaz en inglés (los textos quedan centralizados en `strings.ts`, nada más)

## Enfoque y por qué

PWA en TypeScript, todo en el cliente, sin backend. Se mantiene el rumbo del plan original.

### Stack

| Pieza        | Elección                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- |
| Build        | Vite + TypeScript strict                                                                 |
| UI           | React 19                                                                                 |
| PWA          | vite-plugin-pwa (Workbox): manifest, service worker, offline, share_target               |
| Render PDF   | pdfjs-dist en Web Worker                                                                 |
| Anotaciones  | Capa SVG por página + canvas vivo para el trazo en curso + perfect-freehand              |
| Estado       | `dexie-react-hooks` (`useLiveQuery`) + `useState`. Sin Zustand                           |
| Persistencia | IndexedDB con Dexie, PDFs como Blob                                                      |
| Rutas        | Router mínimo propio sobre `history` (para el botón atrás de Android). Sin librería      |
| Estilos      | CSS plano con variables (tokens sacados de los diseños). Sin framework                   |
| Fuentes      | Instrument Sans y Caveat self-hosteadas con `@fontsource` (Google Fonts no anda offline) |
| Backup       | fflate (zip), formato `.atril`                                                           |
| Drive        | Google Identity Services + Drive API v3, scope `drive.file`, `VITE_GOOGLE_CLIENT_ID`     |
| Audio        | Web Audio API directa                                                                    |
| Reordenar    | @dnd-kit                                                                                 |
| Tests        | Vitest + Playwright (Chromium y WebKit)                                                  |
| Hosting      | GitHub Pages                                                                             |

Se instala la última versión estable de cada paquete y se fija en el lockfile. No se suman
dependencias fuera de esta tabla sin justificarlo en el PR.

### Concesiones de la PWA que el código cubre

- Storage en iOS: `navigator.storage.persist()`, pedir instalar antes de importar, backup con
  recordatorio.
- Wake Lock: re-pedirlo en cada `visibilitychange`.
- Audio con iPhone en silencio: `navigator.audioSession.type = "playback"` antes de crear el
  `AudioContext`.
- Memoria de canvas en Safari: renderizar solo la página visible ± 1, liberar canvases
  poniéndolos en 1×1, LRU de 5 bitmaps.
- Lápiz: trazo vivo en canvas superpuesto con `getCoalescedEvents()` cuando exista (fallback al
  evento simple); al soltar se convierte a SVG y se guarda.
- Web Share Target solo en Android; en iOS se importa desde el selector de archivos.

### Modelo de datos

```ts
type ID = string; // crypto.randomUUID()

interface PdfFile {
  id: ID;
  sha256: string;
  blob: Blob;
  size: number;
  pageCount: number;
}
interface Thumbnail {
  scoreId: ID;
  blob: Blob;
}
interface Tag {
  id: ID;
  name: string;
  color: string;
}

interface Score {
  id: ID;
  pdfId: ID;
  title: string;
  composer?: string;
  key?: string;
  tagIds: ID[];
  bpm?: number;
  timeSignature?: string; // "4/4"
  startNotes?: { label?: string; notes: string[] }[]; // [{ label: "S", notes: ["E4"] }]
  reading?: Partial<ReadingPrefs>; // override del ajuste global
  crop?: { top: number; right: number; bottom: number; left: number }; // 0..1
  pageOrder?: number[]; // orden virtual
  autoscrollSpeed?: number;
  lastPage: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
}

interface ReadingPrefs {
  mode: 'paged' | 'vertical' | 'two-up';
  fit: 'width' | 'page';
  pageTurn: 'slide' | 'instant';
  twoUpStep: 1 | 2;
  halfPage: boolean;
  theme: 'light' | 'sepia' | 'dark';
  tapZones: 'thirds' | 'halves';
}

// settings (clave/valor): reading (ReadingPrefs global), penOnlyDrawing (boolean, por
// dispositivo, NO viaja en el backup), lastBackupAt, drive (estado de conexión)

interface PageAnnotations {
  id: string; // `${scoreId}:${page}`
  scoreId: ID;
  page: number; // página real del PDF, base 0
  strokes: Stroke[];
  texts: TextNote[];
  updatedAt: number;
}
interface Stroke {
  id: ID;
  tool: 'pen' | 'highlighter';
  color: string;
  width: number; // fracción del ancho de página
  points: [x: number, y: number, pressure: number][]; // normalizados 0..1
}
interface TextNote {
  id: ID;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
} // fracción del ancho de página

interface SetList {
  id: ID;
  name: string;
  notes?: string;
  items: SetListItem[];
  createdAt: number;
  updatedAt: number;
}
type SetListItem =
  { id: ID; type: 'score'; scoreId: ID; note?: string } | { id: ID; type: 'break'; label: string };

interface Bookmark {
  id: ID;
  scoreId: ID;
  page: number;
  y: number;
  label: string;
}
interface JumpLink {
  id: ID;
  scoreId: ID;
  from: { page: number; x: number; y: number };
  to: { page: number; y: number };
}
```

```ts
db.version(1).stores({
  pdfs: 'id, &sha256',
  thumbnails: 'scoreId',
  tags: 'id, name',
  scores: 'id, pdfId, title, composer, *tagIds, updatedAt, lastOpenedAt',
  annotations: 'id, scoreId, [scoreId+page]',
  setlists: 'id, name, updatedAt',
  bookmarks: 'id, scoreId',
  links: 'id, scoreId',
  settings: 'key',
});
```

Cada cambio de esquema posterior es una nueva `db.version(n)` con migración; nunca se borra la
base.

### Formato `.atril` (zip)

```
manifest.json   { "format": "atril", "version": 1, "exportedAt": "...", "app": "x.y.z" }
scores.json  tags.json  setlists.json  annotations.json  bookmarks.json  links.json  settings.json
pdfs/<sha256>.pdf
```

- Al importar se mezcla por id; si el SHA-256 ya existe se reusa el PDF; ante conflicto gana el
  `updatedAt` más nuevo.
- Backup liviano: el mismo zip sin `pdfs/`, con `pdfs.json` (id + SHA-256). Al importarlo cada
  partitura se reengancha con su PDF si está en el dispositivo; si no, queda marcada para
  reimportar. Es el que se sube a Drive.
- Las miniaturas no viajan: se regeneran al importar.

### Estructura del repo

```
src/
  app/            shell, router, layout, strings.ts, tokens.css
  features/
    library/      grilla, búsqueda, etiquetas, metadatos, importación
    reader/       lector, modos, gestos, ajustes de lectura, lectura avanzada
    annotations/  capa SVG, canvas vivo, herramientas
    setlists/     listas, editor, modo show
    practice/     metrónomo, teclado
    settings/     ajustes, backup, Drive, guía de instalación
  core/
    pdf/          servicio de render, LRU, worker
    db/           esquema Dexie, repositorios
    backup/       exportar e importar .atril, Drive
    audio/        contexto, scheduler, synth
  ui/             componentes compartidos
public/           íconos
tests/e2e/        Playwright
docs/plans/       este plan
```

Reglas: las features importan de `core` y `ui`, nunca entre sí; `core` no importa de features;
solo `core` toca las APIs del navegador.

### UX

Los diseños son referencia de layout, tamaños y jerarquía, no de píxeles. Principios: cero
chrome en lectura, objetivos táctiles de 48 px mínimo (más grandes en modo show), anotaciones
bloqueadas en modo show, tablet como caso principal y celular vertical como secundario, todo
texto en español centralizado en `strings.ts`.

Gestos:

| Gesto                             | Leyendo                                          | Anotando                       |
| --------------------------------- | ------------------------------------------------ | ------------------------------ |
| Toque en tercio derecho/izquierdo | Avanza/retrocede                                 | Dibuja, salvo con "solo lápiz" |
| Toque al centro                   | Muestra/oculta barras (se van a los 3 s)         | —                              |
| Swipe horizontal                  | En paginado arrastra la hoja y la pasa al soltar | —                              |
| Pellizco                          | Zoom                                             | Zoom                           |
| Doble toque                       | Alterna ajuste a ancho y a página                | —                              |
| Apoyar el lápiz                   | Entra a anotar con la última herramienta         | Dibuja                         |
| Toque con dos dedos               | —                                                | Deshacer                       |
| Flechas, PageUp/Down, espacio     | Pasan página (cubre pedales Bluetooth)           | —                              |

## Pasos

Un solo PR contra `test`. Un commit por paso, formato Conventional Commits en español. Cada paso
deja `npm run lint`, `npm run test` y `npm run build` en verde.

1. **Andamiaje.** `git init`, ramas `main` y `test`, rama de trabajo `feat/atril`. Vite + React +
   TS strict, ESLint, Prettier, Vitest, Playwright (Chromium y WebKit), vite-plugin-pwa con
   manifest e íconos provisorios, `@fontsource` de las dos fuentes, `tokens.css` con los colores
   de los diseños, workflow de GitHub Actions para lint + test + deploy a Pages. Generar
   `CLAUDE.md` con la skill `onboard`.
   Commit: `chore: andamiaje del proyecto, PWA y CI`
2. **Base de datos.** `core/db`: esquema Dexie v1 de arriba, repositorios tipados por tabla,
   tests con `fake-indexeddb` (dev dependency).
   Commit: `feat(db): esquema Dexie y repositorios`
3. **PDF e importación.** `core/pdf`: worker de pdfjs, servicio de render con LRU de 5 y
   pre-render, liberación de canvases. Importación múltiple con SHA-256, conteo de páginas y
   miniatura sin bloquear la UI, `storage.persist()`.
   Commit: `feat(pdf): render en worker e importación de PDFs`
4. **Shell y biblioteca.** Router mínimo, navegación (barra lateral en tablet, inferior en
   celular), `strings.ts`. Grilla/lista, búsqueda por título y compositor, etiquetas con color
   (alta, filtro), orden reciente/A-Z, edición de metadatos.
   Commit: `feat(library): biblioteca, etiquetas y metadatos`
5. **Lector.** Modos paginado, vertical y dos páginas; zonas de toque; swipe que sigue al dedo;
   barras que se ocultan; temas; zoom y doble toque; Wake Lock; última página; hoja de ajustes
   de lectura (global y por partitura); teclas y pedal.
   Commit: `feat(reader): lector con modos, gestos y ajustes de lectura`
6. **Anotaciones.** Capa SVG por página, canvas vivo, lápiz (5 colores, 3 grosores), resaltador,
   texto, goma por trazo, deshacer/rehacer, mostrar/ocultar capa, "solo el lápiz dibuja",
   guardado por página con coordenadas normalizadas.
   Commit: `feat(annotations): anotar sobre la partitura`
7. **Listas y modo show.** Alta, edición, duplicado, notas, reordenar con @dnd-kit, separadores.
   Modo show: lista en orden, aviso "Siguiente" en la última página, índice desplegable,
   anotaciones bloqueadas.
   Commit: `feat(setlists): listas y modo show`
8. **Backup local.** Exportar/importar `.atril` completo y liviano, mezcla por id y `updatedAt`,
   recordatorio a los 7 días.
   Commit: `feat(backup): exportar e importar .atril`
9. **Backup en Drive.** Google Identity Services, scope `drive.file`, subida del backup liviano a
   la carpeta "Atril" con debounce tras cada cambio, restaurar eligiendo un backup, aviso si una
   subida falla. Si falta `VITE_GOOGLE_CLIENT_ID` la sección se muestra deshabilitada.
   Commit: `feat(backup): backup automático en Google Drive`
10. **Audio.** `core/audio` con `audioSession` en playback y scheduler lookahead. Metrónomo (BPM
    30–250, compás, acento, tap tempo, flash, BPM por partitura), teclado de dos octavas con
    cambio de octava, botón de notas de inicio en el lector.
    Commit: `feat(practice): metrónomo, teclado y notas de inicio`
11. **Lectura avanzada.** Media página, saltos con botón de regreso, recorte de márgenes
    (automático o manual), orden virtual de páginas, marcadores, autoscroll con velocidad por
    partitura.
    Commit: `feat(reader): media página, saltos, recorte, marcadores y autoscroll`
12. **Pulido.** Guía de "Agregar a inicio" en iOS, Web Share Target en Android, accesibilidad
    básica, versión visible en ajustes, e2e de punta a punta.
    Commit: `feat: instalación, share target y pulido`

## Tests

- Vitest: repositorios (paso 2), SHA-256 y dedupe (3), LRU (3), búsqueda y filtros con 300
  partituras en menos de 100 ms (4), normalización de coordenadas de trazos (6), mezcla de
  backup por id y `updatedAt` e ida y vuelta export → import (8), scheduler del metrónomo (10),
  orden virtual de páginas (11).
- Playwright, en Chromium y WebKit: importar un PDF y verlo en la biblioteca; pasar página con
  toque y con teclado; dibujar un trazo, recargar y verlo; recorrer una lista en modo show solo
  con toques; exportar, borrar la base e importar; la app abre offline.
- Manual, no automatizable acá: latencia del lápiz, audio con iPhone en silencio, Wake Lock,
  instalación en iOS y Android, flujo real de Drive.

## Riesgos

| Riesgo                            | Mitigación                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS borra los datos del navegador | `storage.persist()`, backup con recordatorio, Drive                                                                                             |
| Lápiz lento en web                | Canvas vivo y eventos coalescidos. Se decidió no hacer spike previo: si no alcanza, se descubre al probar en dispositivo con todo ya construido |
| PDFs escaneados de 50 MB o más    | Render a resolución de pantalla en worker, LRU chica, liberar canvases                                                                          |
| Diferencias de Safari             | Playwright con WebKit en CI y prueba manual                                                                                                     |
| Un PR único muy grande            | Commits por paso, cada uno en verde, para poder revisar de a uno                                                                                |
| Drive sin probar de punta a punta | Queda detrás de `VITE_GOOGLE_CLIENT_ID`; se prueba cuando exista el cliente OAuth                                                               |

## Qué cambió respecto del plan original

Correcciones del usuario:

- **Sin hitos ni entregas parciales**: se hace todo de una, fase 1 + fase 2, en un PR. Por eso
  los botones de metrónomo, teclado, marcadores y Drive de los diseños entran todos.
- **Drive entra** y queda implementado aunque todavía no exista el cliente OAuth.

Ajustes acordados:

- `penOnlyDrawing` pasa de `ReadingPrefs` a ajuste global del dispositivo (depende de si hay
  lápiz, no de la partitura).
- `fit` pierde `'height'`: los diseños solo ofrecen "Al ancho" y "Página entera".
- `ReadingPrefs` suma `pageTurn` y `twoUpStep`, que estaban en diseños y features pero no en el
  modelo.
- `Stroke.width` y `TextNote.size` normalizados al ancho de página, para que el grosor no cambie
  entre dispositivos.
- Miniaturas en tabla aparte, para no cargar 300 blobs en cada consulta de la biblioteca.
- Tabla `tags` con color; `Score.tags: string[]` pasa a `tagIds`.
- `startNotes[].label` opcional: cubre tanto notas por voz (S, A, T, B) como un acorde único.

Alternativas descartadas:

- **Zustand**: `useLiveQuery` cubre el estado que sale de la base y el resto es local.
- **Librería de rutas y framework de CSS**: cinco pantallas no los justifican.
- **Google Fonts por CDN**: rompe el offline.
- **Spike del lápiz antes de construir** y **recortar la v0.1**: propuestos y descartados por el
  usuario, que prefiere hacer todo de una.
- **Nativa, Capacitor o Flutter**: ya descartadas en el plan original por costo de distribución.

## Decisiones abiertas

- Repo remoto en GitHub: hace falta para el PR y para Pages. Falta crearlo (nombre y si es
  público o privado; Pages gratis requiere público).
- Cliente OAuth de Google para Drive: lo crea el usuario; no bloquea la implementación.
- Dispositivos para la prueba manual (iPad con lápiz, tablet Android).
- Nombre definitivo y dominio: no bloquean; arranca como "Atril" en el subdominio de Pages.
