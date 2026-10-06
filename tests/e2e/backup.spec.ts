import { expect, test } from '@playwright/test';
import { importFixtures } from './helpers';

test('exportar, borrar todo e importar deja la biblioteca igual', async ({ page }) => {
  await importFixtures(page);
  await page.getByRole('link', { name: 'Ajustes' }).click();

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar todo (.atril)' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^atril-\d{4}-\d{2}-\d{2}\.atril$/);
  const path = await download.path();
  await expect(page.getByRole('status')).toHaveText('Backup exportado.');

  // Otro "dispositivo": se borra la base y se importa el archivo.
  await page.evaluate(
    () =>
      new Promise<void>((ok) => {
        const req = indexedDB.deleteDatabase('atril');
        req.onsuccess = req.onerror = req.onblocked = () => ok();
      }),
  );
  await page.reload();
  // Dispositivo nuevo: aparecen las pistas. Mientras haya una abierta, el primer toque la cierra.
  await page
    .getByRole('dialog', { name: 'Backup' })
    .getByRole('button', { name: 'Entendido' })
    .click();
  await page.getByTestId('backup-input').setInputFiles(path);
  await expect(page.getByRole('status')).toContainText('Backup importado: 2 partituras.');

  await page.getByRole('link', { name: 'Biblioteca' }).click();
  await page
    .getByRole('dialog', { name: 'Tu biblioteca' })
    .getByRole('button', { name: 'Entendido' })
    .click();
  const grid = page.getByRole('list', { name: 'Partituras' });
  await expect(grid.getByRole('listitem')).toHaveCount(2);
  await expect(grid.locator('img')).toHaveCount(2); // miniaturas regeneradas
  await page.getByRole('button', { name: 'Cancion de ejemplo', exact: true }).click();
  await expect(page.locator('.page canvas').first()).toBeVisible();
});
