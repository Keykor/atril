# Atril

Lector de partituras (PDF) para tablet y celular. PWA 100 % en el cliente, sin backend.
El plan vigente está en `docs/plans/atril.md`; los diseños de referencia están enlazados ahí.

## Comandos

- `npm run dev` — servidor de desarrollo
- `npm run lint` — ESLint + Prettier (check). `npm run format` para arreglar formato
- `npm test` — Vitest (unitarios, `src/**/*.test.ts`)
- `npm run e2e` — Playwright en Chromium y WebKit (hace build + preview)
- `npm run build` — typecheck + build de producción

## Arquitectura

- `src/app/` shell, router por hash, pantallas que componen features, `strings.ts`, `tokens.css`
- `src/features/*` una carpeta por feature. Importan de `core` y `ui`, **nunca entre sí**;
  la composición entre features se hace en `src/app/`
- `src/core/*` servicios (db, pdf, backup, audio). No importa de features. Solo `core` toca
  IndexedDB, Web Audio, Drive y pdf.js
- `src/ui/` componentes compartidos

Reglas del proyecto:

- Todo texto de interfaz va en `src/app/strings.ts`, en español.
- Las anotaciones se guardan normalizadas a la página (0..1, grosores como fracción del ancho)
  y por página real del PDF. El PDF original nunca se modifica.
- Un cambio de esquema es una nueva `db.version(n)` con migración. Nunca se borra la base.
- No sumar dependencias fuera del stack del plan sin justificarlo en el PR.
- Los comentarios `ponytail:` marcan simplificaciones deliberadas y cuándo ampliarlas.

## Git y PRs

- Rama base de los PR: `test`. `main` es lo que se publica en GitHub Pages.
- Ramas: `feat/{slug}`, `fix/{slug}`, `chore/{slug}`.
- Commits: Conventional Commits en español (`feat(reader): …`, `fix(db): …`).
- El merge siempre lo hace una persona.

## Cambios que requieren revisión humana

- Esquema de Dexie y migraciones (`src/core/db/`): un error acá pierde bibliotecas.
- Formato `.atril` e importación/mezcla (`src/core/backup/`).
- OAuth y Drive (`src/core/backup/drive.ts`): scopes, client ID.
- Service worker y manifest (`vite.config.ts`, `src/sw.ts`): un SW roto deja la app instalada
  sin poder actualizarse.
- Workflow de deploy (`.github/workflows/`).

## Contexto no obvio

- iOS: Safari puede desalojar IndexedDB; por eso `storage.persist()`, el recordatorio de backup
  y Drive. La PWA instalada no comparte storage con Safari.
- iOS: Web Audio se silencia con el switch de silencio salvo `navigator.audioSession.type =
"playback"` antes de crear el `AudioContext`.
- Safari corta el render si la memoria total de canvas pasa ~384 MB: se renderiza solo la
  página visible ± 1 y los canvas desalojados se achican a 1×1.
- Web Share Target solo existe en Android.
- No se puede probar en CI: latencia del lápiz, audio en silencio, Wake Lock, instalación,
  flujo real de Drive. Eso es prueba manual en dispositivo.

## Variables de entorno

- `VITE_GOOGLE_CLIENT_ID` — client ID de OAuth de Google (tipo "Aplicación web") para el backup
  en Drive. En local va en `.env.local`; en CI es la variable de repo del mismo nombre. Sin este
  valor la sección de Drive se muestra deshabilitada.
