import { expect, test, type Page } from '@playwright/test';
import { clickBar, importFixtures } from './helpers';

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
  await clickBar(page, 'Ajustes de lectura');
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
  await clickBar(page, 'Anotar');
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
  await clickBar(page, 'Anotar');
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
  await clickBar(page, 'Ensayo');
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
  await clickBar(page, 'Datos de la partitura');
  await expect(page.getByRole('dialog').getByLabel('BPM')).toHaveValue('73');
});

test('las notas de inicio se graban con el teclado y aparece el botón para dar el tono', async ({
  page,
}) => {
  await openScore(page);
  await tapAt(page, 0.5);
  // Sin notas guardadas, el botón "Nota" no está.
  await expect(page.locator('.reader-tools')).not.toContainText('Nota');
  await clickBar(page, 'Ensayo');
  const panel = page.getByRole('region', { name: 'Herramientas de ensayo' });
  await panel.getByRole('button', { name: 'Grabar con el teclado' }).click();
  await panel.getByRole('button', { name: 'Fa4', exact: true }).dispatchEvent('pointerdown');
  await panel.getByRole('button', { name: 'Do4', exact: true }).dispatchEvent('pointerdown');
  await panel.getByRole('button', { name: 'Guardar' }).click();
  await panel.getByRole('button', { name: 'Cerrar herramientas' }).click();
  await clickBar(page, 'Nota · Fa4');
});

test('la barra de anotar entra entera en un celular de 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openScore(page);
  await clickBar(page, 'Anotar');
  for (const name of ['Lápiz', 'Goma', 'Color y grosor', 'Deshacer', 'Rehacer', 'Listo']) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  await page.getByRole('button', { name: 'Listo' }).click();
  await expect(page.getByRole('toolbar')).toHaveCount(0);
});
