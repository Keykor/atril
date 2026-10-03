# Atril

Lector de partituras (PDF) para tablet y celular: biblioteca, lector, anotaciones, listas con
modo show, metrónomo y teclado. PWA en React 19 + TypeScript + Vite, 100 % en el cliente: pdf.js
para renderizar, IndexedDB (Dexie) para guardar, Web Audio para el sonido. Sin backend; Google
Drive es opcional para el backup. Se publica en GitHub Pages.

Cómo está armado, el modelo de datos y el porqué de cada decisión: @docs/arquitectura.md

## Comandos

- `npm run lint` — ESLint + Prettier (check). `npm run format` para arreglar formato.
- `npm test` — Vitest, unitarios en `src/**/*.test.ts` (IndexedDB simulada con `fake-indexeddb`).
- `npm run e2e` — Playwright en Chromium y WebKit; hace build + preview solo.
- `npm run build` — typecheck + build de producción.
- CI (`.github/workflows/ci.yml`) corre lint → test → e2e → build. Antes de commitear, los cuatro
  en verde.

En el sandbox de Claude Code: los navegadores de Playwright no arrancan adentro (Chromium
necesita puertos Mach), así que `npm run e2e` va sin sandbox y con
`PLAYWRIGHT_BROWSERS_PATH` apuntando a un directorio escribible; `git` y `gh` también van
fuera del sandbox. Si `npm install` falla por la cache, usá `npm_config_cache=$TMPDIR/npm-cache`.

## Git y PRs

- Rama base de los PR: `test`. `main` es lo que se publica; `test` → `main` lo mergea una persona.
- **Al mergear `test` → `main`, no borres la rama `test`.** Ya pasó una vez y hubo que recrearla.
- Ramas: `feat/{slug}`, `fix/{slug}`, `chore/{slug}`.
- Commits: Conventional Commits en español con scope de la carpeta (`feat(reader): …`,
  `fix(pdf): …`, `refactor(db): …`, `test(e2e): …`). Cuerpo: qué y por qué, no cómo.
- PR: secciones "Qué hace", "Plan", "Cómo probarlo", "Notas para quien revisa". Decir siempre
  qué no se pudo verificar (ver "Contexto").
- El merge siempre lo hace una persona.

## Convenciones de código

Arquitectura (la hace cumplir ESLint, no la desactives con `eslint-disable`):

- `app/`, `features/` y `ui/` no importan `core/db/db`, `dexie` ni `pdfjs-dist`.
- **Leer datos:** `useLiveQuery(() => consulta())` con funciones de `src/core/db/queries.ts`.
  Si necesitás una consulta nueva, va ahí, con test en `src/core/db/db.test.ts`.
- **Escribir datos:** funciones de `src/core/db/repos.ts`. Borrados en cascada y `updatedAt` se
  manejan ahí, nunca en la pantalla.
- Una feature no importa de otra: lo que junta varias se compone en `src/app/`.
- `core/` no importa de la UI.

Además:

- Todo texto de interfaz va en `src/app/strings.ts`, en español rioplatense (voseo). Nada de
  textos sueltos en componentes.
- Estilos: CSS plano por feature, con las variables de `src/app/tokens.css`. No agregues
  frameworks de CSS. Objetivos táctiles de 44–48 px como mínimo.
- Accesibilidad: `<button>` y `<a>` reales, `aria-label` en botones de solo ícono. Los e2e
  buscan por rol y nombre, así que un nombre accesible roto rompe tests.
- Lo que se dibuja sobre una página (trazos, textos, marcadores, saltos) se guarda normalizado
  (0..1, grosores como fracción del ancho) y por **página real** del PDF, no por posición del
  orden virtual. El PDF original nunca se modifica.
- Estado: no hay store global. Base → `useLiveQuery`; estado de pantalla → `useState`.
- No agregues dependencias sin justificarlo en el PR.
- Comentarios `ponytail:` marcan simplificaciones deliberadas y cuándo ampliarlas; respetalos.

Tests:

- Lógica de `core/` y funciones puras (secuencia de páginas, scheduler del metrónomo, mezcla de
  backups) → unitarios.
- Flujos de usuario → e2e en `tests/e2e/`, con los PDFs de `tests/e2e/fixtures/`.
- En e2e, para tocar un botón de las barras del lector usá `clickBar(page, nombre)` de
  `tests/e2e/helpers.ts`: las barras se ocultan solas a los 3 s y en CI se van antes del click.

## Cambios que requieren revisión humana

Agregá la etiqueta `needs-human` al PR si toca:

- Esquema de Dexie o migraciones (`src/core/db/db.ts`, `types.ts`): un error borra bibliotecas.
- Formato `.atril` e importación/mezcla (`src/core/backup/atril.ts`).
- OAuth y Drive (`src/core/backup/drive.ts`): scopes, client ID.
- Service worker y manifest (`src/sw.ts`, `vite.config.ts`): un SW roto deja la app instalada
  sin poder actualizarse.
- Workflows de GitHub (`.github/workflows/`).
- Reglas de arquitectura en `eslint.config.js`.

## Cómo trabajamos

- Cambios no triviales: plan primero (`docs/plans/{slug}.md`), se discute, y recién ahí se
  implementa, un commit por paso del plan.
- No refactorices fuera del alcance del pedido; anotalo en el PR.
- Si el plan resulta equivocado durante la implementación, frená, actualizá el plan con el
  motivo y avisá.
- Ante una duda de producto o de UX, preguntá: el usuario prueba la app en ensayos reales y
  decide.

## Contexto que no está en el código

- **pdfjs-dist 6:** `PDFDocumentProxy` no tiene `destroy()`; se destruye con
  `doc.loadingTask.destroy()`. Copilot sugiere lo contrario: es un falso positivo.
- **WebKit e IndexedDB:** guardar `Blob` falla en algunos contextos ("Error preparing Blob/File
  data"). Por eso PDFs y miniaturas se guardan como `ArrayBuffer`. No vuelvas a `Blob`.
- **iOS:** Safari puede borrar IndexedDB; el audio necesita `audioSession.type = "playback"`
  antes del `AudioContext`; no hay Web Share Target; la app instalada no comparte datos con
  Safari.
- **No se puede verificar en CI ni con Playwright:** latencia del lápiz, presión, pellizco y
  gestos con dos dedos (los e2e usan mouse), audio con el iPhone en silencio, Wake Lock,
  instalación y el flujo real de Drive. Decilo en el PR cuando el cambio toque algo de eso.
- **Drive:** sin `VITE_GOOGLE_CLIENT_ID` la sección se muestra deshabilitada. El token dura ~1 h y
  renovarlo pide un toque ("Reconectar"): no hay backend con refresh tokens a propósito.
- **Modo show:** en escena la barra de abajo arranca bloqueada (un toque la habilita) y el aviso
  de obra siguiente aparece recién al tocar para avanzar en la última página, para no tapar
  música. Son pedidos explícitos del usuario; no los "simplifiques".
- `docs/plans/` es un registro histórico: cada plan refleja lo decidido en su momento. La
  documentación vigente es `docs/arquitectura.md` y el código.
