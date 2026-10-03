import { expect, test, type Page } from '@playwright/test';
import { clickBar, importFixtures } from './helpers';

const indicator = (page: Page) => page.locator('.page-indicator');

async function openScore(page: Page) {
  await importFixtures(page);
  await page.getByRole('button', { name: 'Cancion de ejemplo', exact: true }).click();
  await expect(indicator(page)).toHaveText('1 / 3');
}
async function tapAt(page: Page, fx: number) {
  const box = (await page.locator('.reader-stage').boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height / 2);
}
const closeSheet = (page: Page) =>
  page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();

test('orden virtual de páginas y marcadores', async ({ page }) => {
  await openScore(page);
  await clickBar(page, 'Más opciones');
  await page.getByLabel('Orden de páginas').fill('1, 2, 3, 2, 3');
  await page.getByLabel('Orden de páginas').blur();
  await closeSheet(page);
  await expect(indicator(page)).toHaveText('1 / 5');

  // Posición 4 del orden virtual = página real 2.
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(indicator(page)).toHaveText('4 / 5');
  await expect(page.locator('.reader-slot[data-where="0"] .page')).toHaveAttribute(
    'data-page',
    '1',
  );

  await clickBar(page, 'Marcadores');
  await page.getByLabel('Nombre del marcador').fill('Letra B');
  await page.getByRole('button', { name: 'En la página 2' }).click();
  await closeSheet(page);
  await page.keyboard.press('ArrowRight');
  await expect(indicator(page)).toHaveText('5 / 5');

  await clickBar(page, 'Marcadores');
  await page.locator('.bookmark-go', { hasText: 'Letra B' }).click();
  await expect(indicator(page)).toHaveText('2 / 5'); // primera aparición de la página 2
});

test('saltos: tocar el origen lleva al destino y se puede volver', async ({ page }) => {
  await openScore(page);
  await clickBar(page, 'Más opciones');
  await page.getByRole('button', { name: 'Agregar salto' }).click();
  await page
    .locator('.reader-slot[data-where="0"]')
    .getByRole('button', { name: 'Elegir el origen del salto' })
    .click();
  await page.getByLabel('Página de destino (1 a 3)').fill('3');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await page.getByRole('button', { name: 'Saltar a la página 3' }).click();
  await expect(indicator(page)).toHaveText('3 / 3');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(indicator(page)).toHaveText('1 / 3');
});

test('recorte de márgenes: la página se agranda y las anotaciones siguen alineadas', async ({
  page,
}) => {
  await openScore(page);
  const full = page.locator('.reader-slot[data-where="0"] .page-full');
  const before = (await full.boundingBox())!;

  await clickBar(page, 'Más opciones');
  await page.getByRole('button', { name: 'Automático' }).click();
  await closeSheet(page);
  await expect.poll(async () => (await full.boundingBox())!.width).toBeGreaterThan(before.width);
  // La capa de anotaciones ocupa la página real completa, no solo lo visible.
  const layer = (await page
    .locator('.reader-slot[data-where="0"] .annotation-layer')
    .boundingBox())!;
  const after = (await full.boundingBox())!;
  expect(layer.width).toBeCloseTo(after.width, 0);
  expect(layer.height).toBeCloseTo(after.height, 0);
});

test('media página y autoscroll', async ({ page }) => {
  await openScore(page);
  await clickBar(page, 'Ajustes de lectura');
  await page.getByRole('switch', { name: 'Media página' }).click();
  await closeSheet(page);
  await tapAt(page, 0.9);
  await expect(page.locator('.half-top .page')).toHaveAttribute('data-page', '1');
  await expect(indicator(page)).toHaveText('1 / 3');
  await tapAt(page, 0.9);
  await expect(indicator(page)).toHaveText('2 / 3');

  await clickBar(page, 'Ajustes de lectura');
  await page.getByRole('button', { name: 'Vertical' }).click();
  await closeSheet(page);
  const scroller = page.locator('.reader-scroll');
  const start = await scroller.evaluate((el) => el.scrollTop);
  await clickBar(page, 'Autoscroll');
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(start + 10);
  await tapAt(page, 0.5); // un toque pausa
  const paused = await scroller.evaluate((el) => el.scrollTop);
  await page.waitForTimeout(400);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(paused);
});

test('una página repetida en el orden virtual se ve en todos los lugares a la vez', async ({
  page,
}) => {
  await openScore(page);
  await clickBar(page, 'Más opciones');
  await page.getByLabel('Orden de páginas').fill('1, 2, 1');
  await page.getByLabel('Orden de páginas').blur();
  await closeSheet(page);
  await page.keyboard.press('ArrowRight');
  await expect(indicator(page)).toHaveText('2 / 3');

  // En la posición 2, el slot anterior y el siguiente muestran la misma página real (la 1).
  for (const where of ['-1', '1']) {
    const slot = page.locator(`.reader-slot[data-where="${where}"]`);
    await expect(slot.locator('.page')).toHaveAttribute('data-page', '0');
    await expect
      .poll(() => slot.locator('.page-canvas canvas').evaluate((c: HTMLCanvasElement) => c.width))
      .toBeGreaterThan(300);
  }
});
