import { expect, test } from '@playwright/test';
import { clickBar, importFixtures } from './helpers';

test('exportar el PDF con anotaciones: lo dibujado queda en su lugar en el PDF nuevo', async ({
  page,
}) => {
  // Sin "Compartir", para que el PDF se descargue y el test lo pueda abrir.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined });
  });
  await importFixtures(page);
  await page.getByRole('button', { name: 'Cancion de ejemplo', exact: true }).click();
  await clickBar(page, 'Anotar');

  // Trazo rojo grueso, horizontal, a 40 % de la altura de la página 1.
  await page.getByRole('button', { name: 'Color y grosor' }).click();
  await page.getByRole('button', { name: 'Grueso' }).click();
  await page.getByRole('button', { name: 'Color y grosor' }).click();
  const box = (await page.locator('.reader-slot[data-where="0"] .page').boundingBox())!;
  const at = (fx: number, fy: number) => [box.x + box.width * fx, box.y + box.height * fy] as const;
  await page.mouse.move(...at(0.3, 0.4));
  await page.mouse.down();
  await page.mouse.move(...at(0.7, 0.4), { steps: 10 });
  await page.mouse.up();
  // Un texto y un símbolo.
  await page.getByRole('button', { name: 'Texto' }).click();
  await page.mouse.click(...at(0.3, 0.7));
  await page.getByLabel('Escribí una nota').fill('respirar');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Símbolos', exact: true }).click();
  await page.getByRole('button', { name: 'Forte (f)' }).click();
  await page.mouse.click(...at(0.6, 0.7));
  await page.getByRole('button', { name: 'Listo' }).click();

  // Exportar desde los datos de la partitura, que explican qué entra.
  await clickBar(page, 'Datos de la partitura');
  const sheet = page.getByRole('dialog', { name: 'Datos de la partitura' });
  await expect(sheet).toContainText('No lleva los marcadores ni los saltos');
  const downloading = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Exportar PDF con anotaciones' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('Cancion de ejemplo (con anotaciones).pdf');
  const path = await download.path();

  // Se importa el PDF exportado como partitura nueva y se mira la página 1.
  await sheet.getByRole('button', { name: 'Cancelar' }).click();
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles({
    name: 'Cancion de ejemplo (con anotaciones).pdf',
    mimeType: 'application/pdf',
    buffer: await import('node:fs/promises').then((fs) => fs.readFile(path)),
  });
  await expect(page.getByRole('status')).toContainText('1 importada');
  await page
    .getByRole('button', { name: 'Cancion de ejemplo (con anotaciones)', exact: true })
    .click();
  await expect(page.locator('.page-indicator')).toHaveText('1 / 3');
  const canvas = page.locator('.reader-slot[data-where="0"] .page-canvas canvas');
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(300);

  // El trazo rojo tiene que estar en el mismo lugar: rojo a la altura del 40 %, en el medio.
  const reddest = (fx: number, fy: number) =>
    canvas.evaluate(
      (c: HTMLCanvasElement, [fx, fy]) => {
        const ctx = c.getContext('2d')!;
        const x = Math.round(c.width * fx);
        const y = Math.round(c.height * fy);
        const { data } = ctx.getImageData(x - 2, y - 8, 5, 17); // un poco de margen vertical
        let best = 0;
        for (let i = 0; i < data.length; i += 4)
          best = Math.max(best, data[i] - (data[i + 1] + data[i + 2]) / 2);
        return best;
      },
      [fx, fy],
    );
  expect(await reddest(0.5, 0.4)).toBeGreaterThan(100); // rojo
  expect(await reddest(0.5, 0.2)).toBeLessThan(30); // en otro lado no hay nada rojo
});
