# Atril

Lector de partituras liviano para tablet y celular. Abre PDFs, se leen cómodo, se anotan con
lápiz o dedo, se arman listas para ensayos y conciertos, y trae metrónomo y un teclado para dar
notas. Es una PWA: se instala desde el navegador, funciona sin conexión y no tiene backend.

## Desarrollo

```bash
npm install
npm run dev
```

- `npm run lint` — ESLint + Prettier
- `npm test` — tests unitarios (Vitest)
- `npm run e2e` — tests de punta a punta (Playwright, Chromium y WebKit). La primera vez:
  `npx playwright install chromium webkit`
- `npm run build` — build de producción en `dist/`

## Publicación

Cada push a `main` corre los tests y publica en GitHub Pages (`.github/workflows/ci.yml`).
Hay que activarlo una vez en el repo: Settings → Pages → Source: **GitHub Actions**.

## Backup en Google Drive (opcional)

1. En Google Cloud Console creá un cliente OAuth de tipo "Aplicación web" y agregá el origen de
   la app (por ejemplo `https://<usuario>.github.io`) a los orígenes de JavaScript autorizados.
2. Habilitá la API de Google Drive en ese proyecto.
3. Guardá el client ID como variable de repositorio `VITE_GOOGLE_CLIENT_ID` (Settings → Secrets
   and variables → Actions → Variables). En local va en `.env.local`.

Sin esa variable la sección de Drive aparece deshabilitada y el resto de la app funciona igual.

## Documentación

- Plan y decisiones: [`docs/plans/atril.md`](docs/plans/atril.md)
- Convenciones del repo: [`CLAUDE.md`](CLAUDE.md)
