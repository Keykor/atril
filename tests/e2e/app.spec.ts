import { expect, test } from '@playwright/test';

test('la app abre', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Atril' })).toBeVisible();
});
