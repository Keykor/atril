import { expect, test, type Page } from '@playwright/test';
import { importFixtures } from './helpers';

async function openScore(page: Page) {
  await importFixtures(page);
  await page.getByRole('button', { name: 'Cancion de ejemplo', exact: true }).click();
  await expect(page.locator('.page-indicator')).toHaveText('1 / 3');
}

/** Toque en una fracción horizontal del lector. */
async function tapAt(page: Page, fx: number) {
  const box = (await page.locator('.reader-stage').boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height / 2);
}

test('pasar página con toque y con teclado, y recordar la última', async ({ page }) => {
  await openScore(page);
  await expect(page.locator('.page canvas').first()).toBeVisible();

  await tapAt(page, 0.9);
  await expect(page.locator('.page-indicator')).toHaveText('2 / 3');
  await page.keyboard.press('PageDown');
  await expect(page.locator('.page-indicator')).toHaveText('3 / 3');
  await tapAt(page, 0.1);
  await expect(page.locator('.page-indicator')).toHaveText('2 / 3');

  await page.waitForTimeout(600); // la posición se guarda con debounce
  await page.reload();
  await expect(page.locator('.page-indicator')).toHaveText('2 / 3');
});

test('el toque al centro muestra las barras y los ajustes cambian el modo', async ({ page }) => {
  await openScore(page);
  await tapAt(page, 0.5);
  await page.getByRole('button', { name: 'Ajustes de lectura' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ajustes de lectura' });
  await sheet.getByRole('button', { name: 'Vertical' }).click();
  await expect(page.locator('.reader-scroll')).toBeVisible();
  await sheet.getByRole('button', { name: 'Dos páginas' }).first().click();
  await expect(page.locator('.page-indicator')).toHaveText('1–2 / 3');
  await sheet.getByRole('button', { name: 'Oscuro' }).click();
  await expect(page.locator('.reader-stage')).toHaveClass(/theme-dark/);
});

test('anotar: el trazo queda guardado, se deshace y se rehace', async ({ page }) => {
  await openScore(page);
  await tapAt(page, 0.5);
  await page.getByRole('button', { name: 'Anotar' }).click();
  const strokes = page.locator('.page[data-page="0"] .annotation-layer path');

  const box = (await page.locator('.page[data-page="0"]').boundingBox())!;
  const at = (fx: number, fy: number) => [box.x + box.width * fx, box.y + box.height * fy] as const;
  await page.mouse.move(...at(0.3, 0.3));
  await page.mouse.down();
  await page.mouse.move(...at(0.5, 0.35), { steps: 5 });
  await page.mouse.move(...at(0.6, 0.3), { steps: 5 });
  await page.mouse.up();
  await expect(strokes).toHaveCount(1);

  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(strokes).toHaveCount(0);
  await page.getByRole('button', { name: 'Rehacer' }).click();
  await expect(strokes).toHaveCount(1);

  await page.getByRole('button', { name: 'Texto' }).click();
  await page.mouse.click(...at(0.4, 0.6));
  await page.getByLabel('Escribí una nota').fill('respirar acá');
  await page.keyboard.press('Enter');
  await expect(page.locator('.annotation-layer text')).toHaveText('respirar acá');

  // Sobrevive a recargar y a otro tamaño de pantalla.
  await page.getByRole('button', { name: 'Listo' }).click();
  await page.setViewportSize({ width: 500, height: 700 });
  await page.reload();
  await expect(strokes).toHaveCount(1);
  await expect(page.locator('.annotation-layer text')).toHaveText('respirar acá');

  // La goma borra por trazo.
  await tapAt(page, 0.5);
  await page.getByRole('button', { name: 'Anotar' }).click();
  await page.getByRole('button', { name: 'Goma' }).click();
  const small = (await page.locator('.page[data-page="0"]').boundingBox())!;
  // Se arranca abajo: en pantallas angostas la barra de herramientas tapa el borde superior.
  await page.mouse.move(small.x + small.width * 0.45, small.y + small.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(small.x + small.width * 0.45, small.y + small.height * 0.25, { steps: 12 });
  await page.mouse.up();
  await expect(strokes).toHaveCount(0);
});

test('metrónomo y teclado: el panel abre, marca los tiempos y guarda el tempo', async ({
  page,
}) => {
  await openScore(page);
  await tapAt(page, 0.5);
  await page.getByRole('button', { name: 'Metrónomo' }).click();
  const panel = page.getByRole('region', { name: 'Herramientas de ensayo' });
  await expect(panel.getByRole('group', { name: 'Teclado de dos octavas' })).toBeVisible();

  await panel.getByRole('button', { name: 'Subir tempo' }).click();
  await expect(panel.locator('.metro-bpm strong')).toHaveText('73');
  await panel.getByRole('button', { name: 'Iniciar' }).click();
  await expect(panel.locator('.metro-beats span[data-on]')).toHaveCount(1);
  await panel.getByRole('button', { name: 'Detener' }).click();
  await panel.getByRole('button', { name: 'Do4', exact: true }).dispatchEvent('pointerdown');

  // El tempo quedó en la partitura.
  await page.waitForTimeout(700);
  await panel.getByRole('button', { name: 'Cerrar herramientas' }).click();
  await tapAt(page, 0.5);
  await page.getByRole('button', { name: 'Más opciones' }).click();
  await page.getByRole('button', { name: 'Datos de la partitura' }).click();
  await expect(page.getByRole('dialog').getByLabel('BPM')).toHaveValue('73');
});
