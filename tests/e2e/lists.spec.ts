import { expect, test } from '@playwright/test';
import { importFixtures } from './helpers';

test('armar una lista, reordenarla y recorrerla en modo show solo con toques', async ({ page }) => {
  await importFixtures(page);
  await page.getByRole('link', { name: 'Listas' }).click();
  await page.getByRole('button', { name: 'Nueva' }).click();
  await page.getByLabel('Nombre de la lista').fill('Concierto de primavera');
  await page.getByLabel('Nombre de la lista').blur();

  await page.getByRole('button', { name: 'Agregar partituras' }).click();
  await page.getByRole('button', { name: 'Agregar Ave verum corpus' }).click();
  await page.getByRole('button', { name: 'Agregar Cancion de ejemplo' }).click();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Agregar separador' }).click();

  const items = page.getByRole('list', { name: 'Orden de la lista' }).getByRole('listitem');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText('Ave verum corpus');

  // Reordenar con el teclado (dnd-kit): el separador sube al medio.
  await page.getByRole('button', { name: 'Mover Intervalo' }).focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  await page.keyboard.press('Space');
  await expect(items.nth(1).getByLabel('Nombre del separador')).toHaveValue('Intervalo');

  // Modo show: Ave verum (2 páginas) -> intervalo -> Canción de ejemplo.
  await page.getByRole('button', { name: 'Modo show' }).click();
  await expect(page.locator('.page-indicator')).toHaveText('1 / 2');
  const box = (await page.locator('.reader-stage').boundingBox())!;
  const tapRight = () => page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
  await tapRight();
  await expect(page.locator('.page-indicator')).toHaveText('2 / 2');
  await expect(page.locator('.show-next')).toContainText('Intervalo');
  await expect(page.locator('.show-next')).toContainText('Después, Cancion de ejemplo');
  await tapRight();
  await expect(page.locator('.page-indicator')).toHaveText('1 / 3');
  await expect(page.getByLabel('obra 2 de 2')).toBeVisible();

  // En modo show anotar arranca bloqueado.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('button', { name: 'Anotar bloqueado' })).toBeVisible();
});
