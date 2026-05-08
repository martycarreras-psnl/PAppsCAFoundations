import { test, expect } from '@playwright/test';

test.describe('App — E2E smoke', () => {
  test('renders the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows prototype or connected mode badge', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Prototype Mode|Connected Mode/)).toBeVisible();
  });
});
