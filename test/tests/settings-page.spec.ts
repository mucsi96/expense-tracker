import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { getExpenses } from '../utils';

const openSettings = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByRole('button', { name: 'TU' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
};

test('navigates to settings from the user menu', async ({ page }) => {
  await openSettings(page);

  await expect(page).toHaveTitle('Settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Clear all transactions' })
  ).toBeVisible();
});

test('asks for confirmation before clearing transactions', async ({ page }) => {
  await openSettings(page);

  await page.getByRole('button', { name: 'Clear all transactions' }).click();

  await expect(
    page.getByRole('heading', { name: 'Clear all transactions?' })
  ).toBeVisible();
  await expect(
    page.getByRole('dialog').getByText('This action cannot be undone')
  ).toBeVisible();
});

test('clears all transactions after confirmation', async ({ page }) => {
  await openSettings(page);

  await page.getByRole('button', { name: 'Clear all transactions' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('All transactions deleted')).toBeVisible();
  await expect.poll(async () => {
    const expenses = await getExpenses();
    return expenses.length;
  }).toBe(0);
});

test('shows error notification when cleanup fails', async ({ page }) => {
  await page.route(
    '**/api/expenses',
    (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({ status: 500 })
        : route.fallback()
  );
  await openSettings(page);

  await page.getByRole('button', { name: 'Clear all transactions' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Failed to delete transactions')).toBeVisible();
  await expect.poll(async () => {
    const expenses = await getExpenses();
    return expenses.length;
  }).toBe(2);
});

test('keeps transactions when cleanup is cancelled', async ({ page }) => {
  await openSettings(page);

  await page.getByRole('button', { name: 'Clear all transactions' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(
    page.getByRole('heading', { name: 'Clear all transactions?' })
  ).not.toBeVisible();
  await expect.poll(async () => {
    const expenses = await getExpenses();
    return expenses.length;
  }).toBe(2);
});
