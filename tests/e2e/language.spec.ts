import { expect, test } from '@playwright/test';
import { FIXTURES, hideHints } from './helpers';

test.use({ locale: 'en-US' });

test('toma el idioma del dispositivo y se cambia en Ajustes', async ({ page }) => {
  await page.goto('/');
  await hideHints(page, 'Library');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByTestId('import-input').setInputFiles(FIXTURES[0]);
  await expect(page.getByRole('status')).toContainText('1 imported');

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
