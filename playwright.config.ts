import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined, // el runner tiene 2 núcleos y pdf.js los usa
  // Los tests buscan los textos en español; el de idioma usa su propio locale.
  use: { baseURL: 'http://localhost:4173', locale: 'es-AR' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Galaxy Tab S4'] } },
    { name: 'webkit', use: { ...devices['iPad (gen 7)'] } },
  ],
});
