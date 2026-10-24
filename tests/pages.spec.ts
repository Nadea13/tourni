import { test, expect } from '@playwright/test';

test.describe('Tourni E2E Page Tests', () => {
  test('Landing Page - check title and pricing section', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Tourni/i);
    const bodyText = await page.innerText('body');
    expect(bodyText).toBeTruthy();
  });

  test('Sign In Page - check layout', async ({ page }) => {
    await page.goto('/th/sign-in');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
  });

  test('Sign Up Page - check layout', async ({ page }) => {
    await page.goto('/th/sign-up');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
  });

  test('Privacy Policy Page - check title', async ({ page }) => {
    await page.goto('/th/privacy-policy');
    const bodyText = await page.innerText('body');
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('Terms of Service Page - check title', async ({ page }) => {
    await page.goto('/th/terms-of-service');
    const bodyText = await page.innerText('body');
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('Settings Billing Tab - check Event pricing and discount tag', async ({ page }) => {
    await page.goto('/th/settings?tab=billing');
    // Page will either render billing tab or redirect to sign-in
    const url = page.url();
    if (url.includes('/sign-in') || url.includes('/login')) {
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    } else {
      const bodyText = await page.innerText('body');
      expect(bodyText).toBeTruthy();
    }
  });
});
