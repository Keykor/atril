import { expect, test } from '@playwright/test';
import { importFixtures } from './helpers';

test('armar una lista, reordenarla y recorrerla en modo show solo con toques', async ({ page }) => {
  await importFixtures(page);
  await page.getByRole('link', { name: 'Listas' }).click();
  // Cancelar no deja una lista vacía.
  await page.getByRole('button', { name: 'Nueva' }).click();
  await page
    .getByRole('dialog', { name: 'Nueva lista' })
    .getByRole('button', { name: 'Cancelar' })
    .click();
  await expect(
    page.getByRole('list', { name: 'Todas las listas' }).getByRole('listitem'),
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Nueva' }).click();
  const naming = page.getByRole('dialog', { name: 'Nueva lista' });
  await naming.getByLabel('Nombre de la lista').fill('Concierto de primavera');
  await naming.getByRole('button', { name: 'Crear' }).click();
  await expect(page.getByLabel('Nombre de la lista')).toHaveValue('Concierto de primavera');

  await page.getByRole('button', { name: 'Agregar partituras' }).click();
  await page.getByRole('button', { name: 'Agregar Ave verum corpus' }).click();
  await page.getByRole('button', { name: 'Agregar Cancion de ejemplo' }).click();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Agregar separador' }).click();

  const items = page.getByRole('list', { name: 'Orden de la lista' }).getByRole('listitem');
  await expect(items).toHaveCount(3);
  // Recordatorio de "No molestar" al lado de Modo show, con el cómo plegado.
  await page.getByText('Antes de tocar, activá "No molestar"').click();
  await expect(page.getByText(/^Android: bajá la cortina/)).toBeVisible();
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
  // El aviso no aparece solo: no tapa la última página mientras se lee.
  await expect(page.locator('.show-next')).toHaveCount(0);
  await tapRight();
  await expect(page.locator('.show-next')).toContainText('Intervalo');
  await expect(page.locator('.show-next')).toContainText('Después, Cancion de ejemplo');
  await tapRight();
  await expect(page.locator('.page-indicator')).toHaveText('1 / 3');
  await expect(page.getByLabel('obra 2 de 2')).toBeVisible();
  await expect(page.locator('.show-next')).toHaveCount(0);

  // En modo show la barra de abajo arranca bloqueada: hace falta un toque de confirmación.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const tools = page.locator('.reader-bottom');
  await expect(tools.getByRole('button', { name: 'Anotar' })).toHaveCount(0);
  await tools.getByRole('button', { name: /Herramientas bloqueadas/ }).click();
  await expect(tools.getByRole('button', { name: 'Anotar' })).toBeVisible();
  await expect(tools.getByRole('button', { name: 'Ensayo' })).toBeVisible();
});
