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
