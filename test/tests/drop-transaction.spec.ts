import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { getExpenses, insertExpense } from '../utils';

// The fixture seeds two July 2026 expenses (Migros Zurich, SBB Ticket) and
// the categories Groceries (with 🛒 emoji and a description), Transport and
// Restaurants.

const expenseItem = (page: Page, description: string) =>
  page.getByRole('listitem').filter({ hasText: description });

const selectMonth = async (page: Page, name: string) =>
  page.getByRole('radio', { name }).click();

const descriptions = async () =>
  (await getExpenses()).map((expense) => expense.description);

test('drops a transaction from the category picker', async ({ page }) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expenseItem(page, 'Migros Zurich')
    .getByRole('button', { name: 'Change category: Groceries' })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Drop transaction' })
    .click();
  await page.getByRole('button', { name: 'Drop', exact: true }).click();

  await expect(page.getByText('Transaction dropped')).toBeVisible();
  await expect(expenseItem(page, 'Migros Zurich')).not.toBeVisible();
  await expect(expenseItem(page, 'SBB Ticket')).toBeVisible();
  await expect.poll(descriptions).toEqual(['SBB Ticket']);
});

test('drops an uncategorized transaction', async ({ page }) => {
  await insertExpense('2026-07-05T10:00:00Z', 'Unknown Shop', '', 9.9, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');

  const uncategorized = page.getByRole('region', { name: 'Uncategorized' });
  await uncategorized
    .getByRole('listitem')
    .filter({ hasText: 'Unknown Shop' })
    .getByRole('button', { name: 'Change category: Uncategorized' })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Drop transaction' })
    .click();
  await page.getByRole('button', { name: 'Drop', exact: true }).click();

  await expect(uncategorized).not.toBeVisible();
  await expect.poll(descriptions).toEqual(['Migros Zurich', 'SBB Ticket']);
});

test('asks for confirmation naming the transaction before dropping', async ({
  page,
}) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expenseItem(page, 'Migros Zurich')
    .getByRole('button', { name: 'Change category: Groceries' })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Drop transaction' })
    .click();

  const confirmation = page.getByRole('dialog');
  await expect(
    confirmation.getByRole('heading', { name: 'Drop transaction?' })
  ).toBeVisible();
  await expect(confirmation).toContainText('Migros Zurich');
  await expect(confirmation).toContainText('This action cannot be undone');
});

test('keeps the transaction when the drop is cancelled', async ({ page }) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expenseItem(page, 'Migros Zurich')
    .getByRole('button', { name: 'Change category: Groceries' })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Drop transaction' })
    .click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();
  await expect.poll(descriptions).toEqual(['Migros Zurich', 'SBB Ticket']);
});

test('keeps the transaction when the picker is dismissed', async ({ page }) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expenseItem(page, 'Migros Zurich')
    .getByRole('button', { name: 'Change category: Groceries' })
    .click();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect.poll(descriptions).toEqual(['Migros Zurich', 'SBB Ticket']);
});

test('shows an error when the drop fails', async ({ page }) => {
  await page.route('**/api/expenses/*', (route) =>
    route.request().method() === 'DELETE'
      ? route.fulfill({ status: 500 })
      : route.fallback()
  );
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expenseItem(page, 'Migros Zurich')
    .getByRole('button', { name: 'Change category: Groceries' })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Drop transaction' })
    .click();
  await page.getByRole('button', { name: 'Drop', exact: true }).click();

  await expect(page.getByText('Failed to drop transaction')).toBeVisible();
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();
  await expect.poll(descriptions).toEqual(['Migros Zurich', 'SBB Ticket']);
});

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('drops a transaction with touch without horizontal scrolling', async ({
    page,
  }) => {
    await page.goto('/');
    await selectMonth(page, 'Jul 2026');

    await expenseItem(page, 'Migros Zurich')
      .getByRole('button', { name: 'Change category: Groceries' })
      .tap();

    const dropOption = page
      .getByRole('dialog')
      .getByRole('button', { name: 'Drop transaction' });
    const tapTarget = await dropOption.boundingBox();
    expect(tapTarget?.height).toBeGreaterThanOrEqual(44);

    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(horizontalOverflow).toBe(0);

    await dropOption.tap();
    await page.getByRole('button', { name: 'Drop', exact: true }).tap();

    await expect(expenseItem(page, 'Migros Zurich')).not.toBeVisible();
    await expect.poll(descriptions).toEqual(['SBB Ticket']);
  });
});
