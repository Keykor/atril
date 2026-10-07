import { expect, test } from '@playwright/test';
import { FIXTURES, clickBar, hideHints } from './helpers';

test.use({ locale: 'en-US' });

test('toma el idioma del dispositivo y se cambia en Ajustes', async ({ page }) => {
  // Primero importar: así la base ya existe cuando hideHints la abre por afuera.
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles(FIXTURES[0]);
  await expect(page.getByRole('status')).toContainText('1 imported');
  await hideHints(page, 'Library');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(
    page.getByText('Automatic follows your device’s language (now English)'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Automatic' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: 'Español' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('button', { name: 'Español' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: 'Automático' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

test('el cifrado de las notas se elige aparte del idioma', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles(FIXTURES);
  await expect(page.getByRole('status')).toContainText('2 imported');
  await hideHints(page, 'Library');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('button', { name: 'C D E' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Do Re Mi' }).click();
  await expect(page.getByRole('button', { name: 'Do Re Mi' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Sigue en inglés: el cifrado no cambia el idioma.
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('link', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Cancion de ejemplo', exact: true }).click();
  await clickBar(page, 'Practice');
  const panel = page.getByRole('region', { name: 'Practice tools' });
  await expect(panel.getByRole('button', { name: 'Do4', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Do sharp 4' })).toBeVisible();
});
