import { expect, test } from '@playwright/test';
import { FIXTURES, importFixtures } from './helpers';

test('importar PDFs, verlos en la biblioteca y no duplicar al reimportar', async ({ page }) => {
  await importFixtures(page);
  const grid = page.getByRole('list', { name: 'Partituras' });
  await expect(grid.getByRole('listitem')).toHaveCount(2);
  await expect(grid.getByText('Cancion de ejemplo')).toBeVisible();
  await expect(grid.locator('img').first()).toBeVisible();

  await page.getByTestId('import-input').setInputFiles(FIXTURES);
  await expect(page.getByRole('status')).toContainText('2 ya estaban');
  await expect(grid.getByRole('listitem')).toHaveCount(2);
});

test('buscar y editar metadatos', async ({ page }) => {
  await importFixtures(page);
  await page.getByPlaceholder('Buscar título o compositor').fill('ave');
  const grid = page.getByRole('list', { name: 'Partituras' });
  await expect(grid.getByRole('listitem')).toHaveCount(1);

  await page.getByRole('button', { name: 'Editar Ave verum corpus' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Compositor').fill('W. A. Mozart');
  await dialog.getByLabel('Tonalidad').fill('Re M');
  await dialog.getByLabel('Tonalidad').blur();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(grid.getByText('W. A. Mozart')).toBeVisible();
  await expect(grid.getByText('Re M')).toBeVisible();
});

test('funciona sin conexión después de la primera carga', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'El WebKit de Playwright no sirve desde el service worker');
  await importFixtures(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancion de ejemplo', exact: true }).click();
  await expect(page.locator('.page canvas').first()).toBeVisible();
});

test('ajustes muestra instalación, backup y versión', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Instalar Atril' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Backup en Google Drive' })).toBeVisible();
  await expect(page.getByText(/^Atril \d+\.\d+\.\d+$/)).toBeVisible();
});
