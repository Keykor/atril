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
/** Toca un punto (en fracciones) de la página a la vista, cuando se está eligiendo un lugar. */
const placePoint = (page: Page, fx: number, fy: number) =>
  page
    .locator('.reader-slot[data-where="0"], .vpage')
    .getByRole('button', { name: 'Elegir el lugar en la página' })
    .first()
    .evaluate(
      (el, [x, y]) => {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            clientX: r.left + r.width * x,
            clientY: r.top + r.height * y,
          }),
        );
      },
      [fx, fy],
    );

async function addBookmark(page: Page, label: string, fx: number, fy: number) {
  await clickBar(page, 'Marcadores y saltos');
  await page.getByRole('button', { name: 'Agregar marcador' }).click();
  await placePoint(page, fx, fy);
  await page.getByRole('textbox', { name: 'Nombre del marcador' }).fill(label);
  await page.getByRole('button', { name: 'Guardar' }).click();
}

const closeSheet = (page: Page) =>
  page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();

test('orden virtual de páginas y marcadores', async ({ page }) => {
  await openScore(page);
  await clickBar(page, 'Página');
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

  await addBookmark(page, 'Letra B', 0.3, 0.4);
  await expect(page.locator('.reader-slot[data-where="0"] .bookmark-flag')).toHaveText('Letra B');
  await page.keyboard.press('ArrowRight');
  await expect(indicator(page)).toHaveText('5 / 5');

  await clickBar(page, 'Marcadores y saltos');
  await page.locator('.bookmark-go', { hasText: 'Letra B' }).click();
  await expect(indicator(page)).toHaveText('2 / 5'); // primera aparición de la página 2
});

test('saltos: tocar el origen lleva al destino, sin cartel encima', async ({ page }) => {
  await openScore(page);
  await clickBar(page, 'Marcadores y saltos');
  await page.getByRole('button', { name: 'Agregar salto' }).click();
  await placePoint(page, 0.8, 0.8);
  await page.getByLabel('A una página (1 a 3)').fill('3');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await page.getByRole('button', { name: 'Saltar a página 3' }).click();
  await expect(indicator(page)).toHaveText('3 / 3');
  await expect(page.getByRole('button', { name: 'Volver' })).toHaveCount(0);
});

test('recorte de márgenes: la página se agranda y las anotaciones siguen alineadas', async ({
  page,
}) => {
  await openScore(page);
  const full = page.locator('.reader-slot[data-where="0"] .page-full');
  const before = (await full.boundingBox())!;

  await clickBar(page, 'Página');
  // Con el panel abierto, la página entra entera en el lado libre: no queda nada debajo.
  const panel = (await page.getByRole('dialog', { name: 'Página' }).boundingBox())!;
  const shown = page.locator('.reader-slot[data-where="0"] .page');
  await expect
    .poll(async () => {
      const b = (await shown.boundingBox())!;
      return b.x + b.width <= panel.x + 1 && b.y + b.height <= panel.y + panel.height + 1;
    })
    .toBe(true);
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
  await clickBar(page, 'Página');
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

test('un marcador en el borde superior se ve dentro de la página', async ({ page }) => {
  await openScore(page);
  await addBookmark(page, 'Arriba', 0.5, 0);
  const pageBox = (await page.locator('.reader-slot[data-where="0"] .page').boundingBox())!;
  const flag = (await page.locator('.bookmark-flag', { hasText: 'Arriba' }).boundingBox())!;
  expect(flag.y).toBeGreaterThanOrEqual(pageBox.y - 1); // redondeo subpíxel
});

test('un salto puede ir a un marcador, y en vertical el marcador lleva al punto exacto', async ({
  page,
}) => {
  await openScore(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(indicator(page)).toHaveText('3 / 3');
  await addBookmark(page, 'Coda', 0.2, 0.7);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(indicator(page)).toHaveText('1 / 3');

  await clickBar(page, 'Marcadores y saltos');
  await page.getByRole('button', { name: 'Agregar salto' }).click();
  await placePoint(page, 0.8, 0.9);
  await page.getByRole('button', { name: 'Destino: Coda' }).click();
  await page.getByRole('button', { name: 'Saltar a Coda' }).click();
  await expect(indicator(page)).toHaveText('3 / 3');
  await expect(page.locator('.bookmark-flag[data-highlight]')).toHaveText('Coda');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(indicator(page)).toHaveText('1 / 3');

  // En modo vertical, ir al marcador deja a la vista el punto marcado, no el tope de la página.
  await clickBar(page, 'Ajustes de lectura');
  await page.getByRole('button', { name: 'Vertical' }).click();
  await closeSheet(page);
  await clickBar(page, 'Marcadores y saltos');
  await page.locator('.bookmark-go', { hasText: 'Coda' }).click();
  const flag = page.locator('.bookmark-flag', { hasText: 'Coda' });
  await expect(flag).toBeInViewport();
  // La página 3 es la última: el scroll llega al fondo, con el punto marcado a la vista.
  expect(await page.locator('.reader-scroll').evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

test('si el orden nuevo deja afuera la página a la vista, vuelve a la primera', async ({
  page,
}) => {
  await openScore(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(indicator(page)).toHaveText('3 / 3');
  await clickBar(page, 'Página');
  await page.getByLabel('Orden de páginas').fill('1, 2');
  await page.getByLabel('Orden de páginas').blur();
  await closeSheet(page);
  await expect(indicator(page)).toHaveText('1 / 2');
  await expect(page.locator('.reader-slot[data-where="0"] canvas').first()).toBeVisible();
});
