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
  // Las notas crecen con el texto, sin manija para estirarlas.
  const notes = page.getByLabel('Notas');
  const h0 = (await notes.boundingBox())!.height;
  await notes.fill(['Afinar antes.', 'Salida por la izquierda.', 'Bis: Ave verum.'].join('\n'));
  await expect.poll(async () => (await notes.boundingBox())!.height).toBeGreaterThan(h0 + 20);
  expect(await notes.evaluate((el) => getComputedStyle(el).resize)).toBe('none');
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
  // Antes de entrar, el recordatorio de "No molestar" (con el cómo plegado). Se puede apagar.
  const dnd = page.getByRole('dialog', { name: 'Antes de empezar' });
  await dnd.getByText('Cómo se hace').click();
  await expect(dnd.getByText(/^Android: bajá la cortina/)).toBeVisible();
  await dnd.getByLabel('No volver a recordarme').check();
  await dnd.getByRole('button', { name: 'Empezar' }).click();
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

test('listas con fecha y etiquetas: orden, filtros y duplicar con fecha nueva', async ({
  page,
}) => {
  await importFixtures(page);
  await page.getByRole('link', { name: 'Listas' }).click();

  const create = async (name: string, date: string) => {
    await page.getByRole('button', { name: 'Nueva', exact: true }).click();
    const d = page.getByRole('dialog', { name: 'Nueva lista' });
    await d.getByLabel('Nombre de la lista').fill(name);
    await d.getByLabel('Fecha').fill(date);
    await d.getByRole('button', { name: 'Crear' }).click();
    await expect(d).toBeHidden();
  };
  await create('Pasada', '2020-05-01');
  // En tablet parada la lista abierta tapa el índice: se vuelve con la flecha.
  await page.getByRole('button', { name: 'Todas las listas' }).click();
  await create('Gala', '2099-12-24');
  // La etiqueta se crea desde la lista abierta (Gala) y queda puesta.
  const editor = page.locator('.list-editor');
  await editor.getByRole('button', { name: 'Nueva etiqueta' }).click();
  await editor.getByLabel('Nombre de la etiqueta nueva').fill('Coro');
  await page.keyboard.press('Enter');
  await expect(editor.getByRole('button', { name: 'Coro' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(editor.getByRole('button', { name: 'Coro' })).toHaveCount(1); // una sola, no duplicada

  const cards = page.getByRole('list', { name: 'Todas las listas' }).getByRole('listitem');
  await page.getByRole('button', { name: 'Todas las listas' }).click();
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText('Gala'); // próxima primero
  await expect(cards.nth(0)).toContainText('Coro');
  await expect(cards.nth(1)).toContainText('Pasada');

  // Filtro por etiqueta y por rango de fechas.
  await page
    .getByRole('group', { name: 'Etiquetas' })
    .first()
    .getByRole('button', { name: 'Coro' })
    .click();
  await expect(cards).toHaveCount(1);
  await page
    .getByRole('group', { name: 'Etiquetas' })
    .first()
    .getByRole('button', { name: 'Todas' })
    .click();
  await page.getByLabel('Hasta').fill('2021-01-01');
  await expect(cards).toHaveCount(1);
  await expect(cards.nth(0)).toContainText('Pasada');
  await page.getByRole('button', { name: 'Borrar fechas' }).click();
  await expect(cards).toHaveCount(2);

  // Duplicar pide nombre y fecha nueva.
  await cards.nth(0).click();
  await page.getByRole('button', { name: 'Duplicar', exact: true }).click();
  const dup = page.getByRole('dialog', { name: 'Duplicar lista' });
  await expect(dup.getByLabel('Nombre de la lista')).toHaveValue('Gala (copia)');
  await dup.getByLabel('Fecha').fill('2099-12-31');
  await dup.getByRole('button', { name: 'Duplicar' }).click();
  await expect(page.getByLabel('Nombre de la lista')).toHaveValue('Gala (copia)');
  await page.getByRole('button', { name: 'Todas las listas' }).click();
  await expect(cards).toHaveCount(3);
});
