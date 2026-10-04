import { readFile, writeFile } from 'node:fs/promises';
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
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
  await expect(grid.getByText('W. A. Mozart')).toBeVisible();
  await expect(grid.getByText('Re M')).toBeVisible();

  // Cancelar descarta lo escrito.
  await page.getByRole('button', { name: 'Editar Ave verum corpus' }).click();
  await dialog.getByLabel('Compositor').fill('Otro');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(grid.getByText('W. A. Mozart')).toBeVisible();
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

test('ajustes muestra instalación, backup y versión con fecha de publicación', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Instalar Atril' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Backup en Google Drive' })).toBeVisible();
  await expect(page.getByText(/^Atril \d+\.\d+\.\d+ · publicada el /)).toBeVisible();
});

test('etiquetas: crear, renombrar y borrar; el aviso de instalar se puede cerrar', async ({
  page,
}) => {
  await importFixtures(page);
  const banner = page.getByRole('button', { name: 'Cerrar aviso de instalación' });
  await banner.click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible();
  await expect(banner).toHaveCount(0);

  const chips = page.locator('.tagnav.chips');
  await chips.getByRole('button', { name: 'Nueva etiqueta' }).click();
  await chips.getByLabel('Nombre de la etiqueta').fill('Sacro');
  await page.keyboard.press('Enter');
  await chips.getByRole('button', { name: 'Editar etiquetas' }).click();
  const sheet = page.getByRole('dialog', { name: 'Editar etiquetas' });
  await sheet.getByLabel('Nombre de la etiqueta Sacro').fill('Navidad');
  await sheet.getByLabel('Nombre de la etiqueta Sacro').blur();
  await expect(chips.getByRole('button', { name: 'Navidad', exact: true })).toBeVisible();
  page.on('dialog', (d) => d.accept());
  await sheet.getByRole('button', { name: 'Eliminar etiqueta Navidad' }).click();
  await expect(chips.getByRole('button', { name: 'Navidad', exact: true })).toHaveCount(0);
});

test('aviso de versión nueva: no se aplica sola y se actualiza con un toque', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'El WebKit de Playwright no sirve desde el service worker');
  await page.goto('/');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const banner = page.getByText('Hay una versión nueva de Atril.');
  await expect(banner).toHaveCount(0);

  // Se "publica" una versión nueva: el sw.js que sirve el preview cambia de contenido.
  // (page.route no intercepta la descarga del service worker, por eso se toca el archivo.)
  const swPath = 'dist/sw.js';
  const original = await readFile(swPath, 'utf8');
  try {
    await writeFile(swPath, `${original}\n// versión nueva ${Date.now()}`);
    await page.reload();
    await expect(banner).toBeVisible();
    // Queda esperando: no se activa sola.
    const waiting = () =>
      page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r?.waiting));
    expect(await waiting()).toBe(true);

    // "Actualizar" activa la versión nueva y recarga la página.
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Actualizar' }).click(),
    ]);
    await expect.poll(waiting).toBe(false);
    await expect(banner).toHaveCount(0);
  } finally {
    await writeFile(swPath, original);
  }
});

test('tutorial: pistas de una sola vez y "Mostrame" las vuelve a mostrar en su lugar', async ({
  page,
}) => {
  await importFixtures(page, undefined, true);
  const done = (name: string) =>
    page.getByRole('dialog', { name }).getByRole('button', { name: 'Entendido' }).click();

  await done('Tu biblioteca');
  await page.getByRole('button', { name: 'Cancion de ejemplo', exact: true }).click();
  const reader = page.getByRole('dialog', { name: 'Cómo se lee' });
  await expect(reader.locator('..')).toContainText('Página siguiente');
  await done('Cómo se lee');
  await expect(reader).toBeHidden(); // ya quedó guardado
  await page.reload();
  await expect(page.locator('.page-indicator')).toHaveText('1 / 3');
  await expect(reader).toBeHidden();

  await page.goto('/#/settings');
  await done('Backup');
  await expect(page.getByRole('dialog', { name: 'Backup' })).toBeHidden();
  await page.getByRole('link', { name: 'Ver cómo se usa' }).click();
  await page.getByRole('button', { name: 'Mostrame: Ensayo' }).click();
  // Abre la última partitura con el panel de ensayo y la pista encima.
  await expect(page.getByRole('region', { name: 'Herramientas de ensayo' })).toBeVisible();
  await done('Ensayo');
  await expect(page.getByRole('dialog', { name: 'Ensayo' })).toBeHidden();
});

test('tutorial: quien ya tenía partituras no ve las pistas', async ({ page }) => {
  await importFixtures(page, undefined, true);
  // Simula una instalación anterior: se borran las marcas y se recarga con la biblioteca llena.
  await page.evaluate(
    () =>
      new Promise<void>((ok) => {
        const open = indexedDB.open('atril');
        open.onsuccess = () => {
          const tx = open.result.transaction('settings', 'readwrite');
          tx.objectStore('settings').delete('hintsSeen');
          tx.objectStore('settings').delete('hintsKnown');
          tx.oncomplete = () => {
            open.result.close();
            ok();
          };
        };
      }),
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Tu biblioteca' })).toBeHidden();
  await page.getByRole('button', { name: 'Cancion de ejemplo', exact: true }).click();
  await expect(page.locator('.page-indicator')).toHaveText('1 / 3');
  await expect(page.getByRole('dialog', { name: 'Cómo se lee' })).toBeHidden();
});
