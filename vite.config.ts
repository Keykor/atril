/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// En GitHub Pages la app vive en /atril/; el workflow setea BASE.
const base = process.env.BASE ?? '/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // SW propio (src/sw.ts): precache + Web Share Target.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      injectManifest: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5_000_000,
      },
      manifest: {
        name: 'Atril',
        short_name: 'Atril',
        description: 'Lector de partituras liviano para tablet y celular',
        lang: 'es',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        theme_color: '#2950C7',
        background_color: '#F4F4F1',
        share_target: {
          action: 'share',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { files: [{ name: 'pdfs', accept: ['application/pdf', '.pdf'] }] },
        },
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
