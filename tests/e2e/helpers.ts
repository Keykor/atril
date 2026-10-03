import { expect, type Page } from '@playwright/test';

export const FIXTURES = [
  'tests/e2e/fixtures/Cancion_de_ejemplo.pdf',
  'tests/e2e/fixtures/Ave verum corpus.pdf',
];

/** Abre la app e importa los PDFs de prueba. */
export async function importFixtures(page: Page, files = FIXTURES) {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles(files);
  await expect(page.getByRole('status')).toContainText(/importada/);
}
