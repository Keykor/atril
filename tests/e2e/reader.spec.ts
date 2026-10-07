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
  // En tablet es un panel lateral a la derecha: la partitura sigue a la vista.
  const box = (await sheet.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width - 1);
  expect(box.width).toBeLessThanOrEqual(viewport.width / 2 + 1);
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
  for (const name of [
    'Lápiz',
    'Goma',
    'Símbolos',
    'Color y grosor',
    'Deshacer',
    'Rehacer',
    'Listo',
  ]) {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  await page.getByRole('button', { name: 'Listo' }).click();
  await expect(page.getByRole('toolbar')).toHaveCount(0);
});

test('el número de página no tapa la lectura: aparece solo con las barras', async ({ page }) => {
  await openScore(page);
  const indicator = page.locator('.page-indicator');
  await expect(indicator).toBeHidden();
  await tapAt(page, 0.9);
  await expect(indicator).toBeHidden();
  await expect(indicator).toHaveText('2 / 3');

  await tapAt(page, 0.5);
  await expect(indicator).toBeVisible();
  // Queda por encima de la barra de abajo, no debajo de ella.
  const bar = (await page.locator('.reader-bottom').boundingBox())!;
  const box = (await indicator.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(bar.y);
});

test('anotando en el celular: un dedo dibuja y dos dedos mueven la página', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Los toques multidedo se simulan con CDP (solo Chromium)');
  // Celular apaisado con la página al ancho: la página es más alta que la pantalla.
  await page.setViewportSize({ width: 844, height: 390 });
  await openScore(page);
  await clickBar(page, 'Ajustes de lectura');
  await page.getByRole('button', { name: 'Al ancho' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await clickBar(page, 'Anotar');

  const cdp = await page.context().newCDPSession(page);
  type P = { x: number; y: number };
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', points: P[]) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p, id) => ({ ...p, id })),
    });
  /** Arrastra los dedos desde `from` desplazándolos (dx, dy) en varios pasos. */
  const drag = async (from: P[], dx: number, dy: number) => {
    await touch('touchStart', from);
    for (let i = 1; i <= 8; i++)
      await touch(
        'touchMove',
        from.map((p) => ({ x: p.x + (dx * i) / 8, y: p.y + (dy * i) / 8 })),
      );
    await touch('touchEnd', []);
  };

  const slot = page.locator('.reader-slot[data-where="0"]');
  const scrollTop = () => slot.evaluate((el) => el.scrollTop);
  const strokes = page.locator('.reader-slot[data-where="0"] .annotation-layer path');

  // Un dedo: dibuja y la página no se mueve.
  await drag([{ x: 300, y: 200 }], 150, 30);
  await expect(strokes).toHaveCount(1);
  expect(await scrollTop()).toBe(0);

  // Dos dedos: mueven la página, no dibujan ni deshacen.
  await drag(
    [
      { x: 350, y: 300 },
      { x: 500, y: 300 },
    ],
    0,
    -180,
  );
  await expect.poll(scrollTop).toBeGreaterThan(100);
  await expect(strokes).toHaveCount(1);
});

test('con zoom se sigue pasando de hoja, y el botón de ajuste lo saca', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Los toques multidedo se simulan con CDP (solo Chromium)');
  await openScore(page);
  const cdp = await page.context().newCDPSession(page);
  type P = { x: number; y: number };
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', points: P[]) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p, id) => ({ ...p, id })),
    });
  const zoom = () =>
    page
      .locator('.reader-stage')
      .evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--z')));
  const box = (await page.locator('.reader-stage').boundingBox())!;
  const cy = box.y + box.height / 2;
  const cx = box.x + box.width / 2;

  // Pellizco: los dedos se separan.
  await touch('touchStart', [
    { x: cx - 40, y: cy },
    { x: cx + 40, y: cy },
  ]);
  for (let i = 1; i <= 8; i++)
    await touch('touchMove', [
      { x: cx - 40 - i * 20, y: cy },
      { x: cx + 40 + i * 20, y: cy },
    ]);
  await touch('touchEnd', []);
  await expect.poll(zoom).toBeGreaterThan(1.5);

  // Toque al costado: pasa de hoja y mantiene el zoom.
  await tapAt(page, 0.9);
  await expect(page.locator('.page-indicator')).toHaveText('2 / 3');
  expect(await zoom()).toBeGreaterThan(1.5);

  // Un dedo hacia la izquierda: recorre hasta el borde y, de largo, pasa de hoja.
  await touch('touchStart', [{ x: box.x + box.width - 20, y: cy }]);
  for (let i = 1; i <= 40; i++)
    await touch('touchMove', [{ x: box.x + box.width - 20 - i * 80, y: cy }]);
  await touch('touchEnd', []);
  await expect(page.locator('.page-indicator')).toHaveText('3 / 3');

  await clickBar(page, 'Ajuste de página');
  await expect.poll(zoom).toBe(1);
});

test('el pellizco hace zoom desde donde están los dedos', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Los toques multidedo se simulan con CDP (solo Chromium)');
  await openScore(page);
  const cdp = await page.context().newCDPSession(page);
  type P = { x: number; y: number };
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', points: P[]) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p, id) => ({ ...p, id })),
    });
  const pageBox = page.locator('.reader-slot[data-where="0"] .page').first();
  const b = (await pageBox.boundingBox())!;
  // Los dedos sobre un punto de abajo a la derecha de la página.
  const c = { x: b.x + b.width * 0.8, y: b.y + b.height * 0.8 };
  const at = (box: { x: number; y: number; width: number; height: number }) => ({
    fx: (c.x - box.x) / box.width,
    fy: (c.y - box.y) / box.height,
  });
  const before = at(b);
  await touch('touchStart', [
    { x: c.x - 30, y: c.y },
    { x: c.x + 30, y: c.y },
  ]);
  for (let i = 1; i <= 8; i++)
    await touch('touchMove', [
      { x: c.x - 30 - i * 10, y: c.y },
      { x: c.x + 30 + i * 10, y: c.y },
    ]);
  await touch('touchEnd', []);
  // Después del zoom, bajo los dedos sigue el mismo punto de la página.
  const after = at((await pageBox.boundingBox())!);
  expect(after.fx).toBeCloseTo(before.fx, 1);
  expect(after.fy).toBeCloseTo(before.fy, 1);
  expect((await pageBox.boundingBox())!.width).toBeGreaterThan(b.width * 1.5);
});

test('al ancho, la hoja nueva arranca arriba, para adelante y para atrás', async ({ page }) => {
  // Celular apaisado: al ancho, la página es más alta que la pantalla.
  await page.setViewportSize({ width: 844, height: 390 });
  await openScore(page);
  await clickBar(page, 'Ajustes de lectura');
  await page.getByRole('button', { name: 'Al ancho' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  const slot = page.locator('.reader-slot[data-where="0"]');
  const scrollTop = () => slot.evaluate((el) => el.scrollTop);

  // Para adelante: primero recorre la página hasta abajo y después pasa.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
    if ((await page.locator('.page-indicator').textContent()) === '2 / 3') break;
  }
  await expect(page.locator('.page-indicator')).toHaveText('2 / 3');
  expect(await scrollTop()).toBe(0);

  // Para atrás: la hoja anterior también arranca arriba, no donde había quedado.
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.page-indicator')).toHaveText('1 / 3');
  await page.waitForTimeout(300);
  expect(await scrollTop()).toBe(0);
});

test('con ensayo abierto se puede bajar la página hasta que no quede nada tapado', async ({
  page,
}) => {
  await openScore(page);
  await clickBar(page, 'Ensayo');
  const panel = (await page.getByRole('region', { name: 'Herramientas de ensayo' }).boundingBox())!;
  const slot = page.locator('.reader-slot[data-where="0"]');
  await slot.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const shown = (await slot.locator('.page').first().boundingBox())!;
  expect(shown.y + shown.height).toBeLessThanOrEqual(panel.y + 1);
});

test('en el celular, metrónomo y teclado van en pestañas; en tablet se ven los dos', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openScore(page);
  await clickBar(page, 'Ensayo');
  const panel = page.getByRole('region', { name: 'Herramientas de ensayo' });
  const keyboard = panel.getByRole('group', { name: 'Teclado de dos octavas' });
  const bpm = panel.locator('.metro-bpm');
  await expect(bpm).toBeVisible();
  await expect(keyboard).toBeHidden();

  // El metrónomo sigue andando al pasar a la pestaña del teclado.
  await panel.getByRole('button', { name: 'Iniciar' }).click();
  await panel.getByRole('tab', { name: 'Teclado' }).click();
  await expect(keyboard).toBeVisible();
  await expect(bpm).toBeHidden();
  await panel.getByRole('tab', { name: 'Metrónomo' }).click();
  await expect(panel.getByRole('button', { name: 'Detener' })).toBeVisible();

  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(keyboard).toBeVisible();
  await expect(bpm).toBeVisible();
  await expect(panel.getByRole('tab', { name: 'Teclado' })).toBeHidden();
});

test('en el celular las hojas ocupan toda la altura y avisan si hay más abajo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await openScore(page);
  await clickBar(page, 'Ajustes de lectura');
  const sheet = page.getByRole('dialog', { name: 'Ajustes de lectura' });
  const box = (await sheet.boundingBox())!;
  expect(box.y).toBeLessThanOrEqual(1);
  expect(box.height).toBeGreaterThanOrEqual(639);

  const more = sheet.locator('.sheet-more');
  await expect(more).toBeVisible();
  await sheet.locator('.sheet-body').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(more).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Cerrar' }).click();

  // La hoja de página muestra el valor de cada recorte.
  await clickBar(page, 'Página');
  await page.getByRole('button', { name: 'Automático' }).click();
  await expect(page.getByRole('dialog').locator('output').first()).toHaveText(/^\d+ %$/);
});

test('símbolos: se pegan con un toque, se mueven, se borran y quedan guardados', async ({
  page,
}) => {
  await openScore(page);
  await clickBar(page, 'Anotar');
  const box = (await page.locator('.reader-slot[data-where="0"] .page').boundingBox())!;
  const at = (fx: number, fy: number) => [box.x + box.width * fx, box.y + box.height * fy] as const;
  const stamps = page.locator('.reader-slot[data-where="0"] text.stamp');

  await page.getByRole('button', { name: 'Símbolos', exact: true }).click();
  const palette = page.getByRole('dialog', { name: 'Símbolos musicales' });
  await palette.getByRole('button', { name: 'Negra', exact: true }).click();
  await expect(palette).toBeHidden();
  await page.mouse.click(...at(0.4, 0.3));
  await expect(stamps).toHaveCount(1);
  await expect(stamps).toHaveAttribute('data-symbol', 'noteQuarterUp');
  // Se dibuja con la fuente Bravura, que viene con la app (sirve sin conexión).
  expect(await page.evaluate(() => document.fonts.check('20px Bravura', ''))).toBe(true);

  // Arrastrarlo lo mueve (no pega otro).
  const x0 = Number(await stamps.getAttribute('x'));
  await page.mouse.move(...at(0.4, 0.3));
  await page.mouse.down();
  await page.mouse.move(...at(0.6, 0.3), { steps: 6 });
  await page.mouse.up();
  await expect(stamps).toHaveCount(1);
  await expect.poll(async () => Number(await stamps.getAttribute('x'))).toBeGreaterThan(x0 + 100);

  // Grosor grueso = símbolo más grande.
  await page.getByRole('button', { name: 'Color y grosor' }).click();
  await page.getByRole('button', { name: 'Grueso' }).click();
  await page.getByRole('button', { name: 'Símbolos', exact: true }).click();
  await palette.getByRole('button', { name: 'Forte (f)' }).click();
  await page.mouse.click(...at(0.3, 0.6));
  await expect(stamps).toHaveCount(2);
  const sizes = await stamps.evaluateAll((els) =>
    els.map((e) => Number(e.getAttribute('font-size'))),
  );
  expect(sizes[1]).toBeGreaterThan(sizes[0]);

  await page.getByRole('button', { name: 'Listo' }).click();
  await page.reload();
  await expect(stamps).toHaveCount(2);

  // La goma los borra y deshacer los vuelve a traer.
  await clickBar(page, 'Anotar');
  await page.getByRole('button', { name: 'Goma' }).click();
  await page.mouse.click(...at(0.6, 0.3));
  await expect(stamps).toHaveCount(1);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(stamps).toHaveCount(2);
});
