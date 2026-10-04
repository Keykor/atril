import { expect, type Page } from '@playwright/test';

export const FIXTURES = [
  'tests/e2e/fixtures/Cancion_de_ejemplo.pdf',
  'tests/e2e/fixtures/Ave verum corpus.pdf',
];

/** Abre la app e importa los PDFs de prueba. Las pistas del tutorial se dan por vistas. */
export async function importFixtures(page: Page, files = FIXTURES, hints = false) {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles(files);
  await expect(page.getByRole('status')).toContainText(/importada/);
  if (!hints) await hideHints(page);
}

/** Marca todas las pistas como vistas, escribiendo directo en IndexedDB. */
export async function hideHints(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((ok, fail) => {
        const open = indexedDB.open('atril');
        open.onerror = () => fail(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('settings', 'readwrite');
          tx.objectStore('settings').put({
            key: 'hintsSeen',
            value: ['reader', 'annotate', 'markers', 'lists'],
          });
          tx.oncomplete = () => {
            open.result.close();
            ok();
          };
          tx.onerror = () => fail(tx.error);
        };
      }),
  );
}

/** Toque en el centro del lector: muestra u oculta las barras. */
export async function tapCenter(page: Page) {
  const box = (await page.locator('.reader-stage').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Toca un botón de las barras del lector, mostrándolas si hace falta. Las barras se ocultan
 * solas a los 3 s: en un CI lento pueden irse antes del click, así que se reintenta.
 * El intervalo es de 1 s para que dos toques al centro no cuenten como doble toque.
 */
export async function clickBar(page: Page, name: string) {
  const button = page
    .locator('.reader-top, .reader-bottom')
    .getByRole('button', { name, exact: true });
  await expect(async () => {
    if (!(await button.isVisible())) await tapCenter(page);
    await button.click({ force: true, timeout: 1000 });
  }).toPass({ intervals: [1000] });
}
