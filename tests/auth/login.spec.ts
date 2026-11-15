import { test as base, expect } from '@playwright/test';

// Uses the plain Playwright test so the auto-login fixture is not applied.
base.describe('Lightning login page', () => {
  base('valid credentials land on the Leads list view', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/crm/login.html');
    await page.getByLabel('Username').fill('qa.admin@crm.test');
    await page.getByLabel('Password').fill('Sales#2026');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/#\/lightning\/o\/Lead\/list$/);
    await expect(page.getByRole('heading', { name: 'All Leads' })).toBeVisible();
  });

  base('wrong password shows the standard Salesforce message', async ({ page }) => {
    await page.goto('/crm/login.html');
    await page.getByLabel('Username').fill('qa.admin@crm.test');
    await page.getByLabel('Password').fill('nope');
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page.getByRole('alert')).toContainText('Please check your username and password');
  });

  base('deep link without session redirects to login', async ({ page }) => {
    await page.goto('/crm/index.html#/lightning/o/Opportunity/list');
    await expect(page).toHaveURL(/login\.html/);
  });
});
