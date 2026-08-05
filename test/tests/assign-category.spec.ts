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

const migrosCategory = async () => {
  const expenses = await getExpenses();
  return expenses.find((expense) => expense.description === 'Migros Zurich')
    ?.category;
};

test('assigns a category to a transaction', async ({ page }) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expenseItem(page, 'Migros Zurich')
    .getByRole('button', { name: 'Change category: Groceries' })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Restaurants' })
    .click();

  await expect(expenseItem(page, 'Migros Zurich')).toContainText('Restaurants');
  await expect.poll(migrosCategory).toBe('Restaurants');
});

test('shows uncategorized transactions and assigns them a category', async ({
  page,
}) => {
  await insertExpense('2026-07-05T10:00:00Z', 'Unknown Shop', '', 9.9, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expenseItem(page, 'Unknown Shop')
    .getByRole('button', { name: 'Change category: Uncategorized' })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Groceries' })
    .click();

  await expect(expenseItem(page, 'Unknown Shop')).toContainText('Groceries');
});

test('shows the category emoji on the transaction', async ({ page }) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expect(
    expenseItem(page, 'Migros Zurich').getByRole('button', {
      name: 'Change category: Groceries',
    })
  ).toContainText('🛒');
});

test('shows the category description as a tooltip on hover', async ({
  page,
}) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  const chip = expenseItem(page, 'Migros Zurich').getByRole('button', {
    name: 'Change category: Groceries',
  });
  await expect(chip).toHaveAccessibleDescription('Migros, Coop, Aldi, Lidl');
  await chip.hover();

  // The description also exists as a hidden aria-describedby message, so
  // scope to the overlay to assert the tooltip itself is shown.
  await expect(
    page
      .locator('.cdk-overlay-container')
      .getByText('Migros, Coop, Aldi, Lidl')
  ).toBeVisible();
});

test('shows the category emoji and description in the picker', async ({
  page,
}) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expenseItem(page, 'SBB Ticket')
    .getByRole('button', { name: 'Change category: Transport' })
    .click();

  const groceriesOption = page
    .getByRole('dialog')
    .getByRole('button', { name: 'Groceries' });
  await expect(groceriesOption).toContainText('🛒');
  await expect(groceriesOption).toContainText('Migros, Coop, Aldi, Lidl');
});

test('keeps the category when the picker is dismissed', async ({ page }) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expenseItem(page, 'Migros Zurich')
    .getByRole('button', { name: 'Change category: Groceries' })
    .click();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(expenseItem(page, 'Migros Zurich')).toContainText('Groceries');
  await expect.poll(migrosCategory).toBe('Groceries');
});

test('shows an error when the update fails', async ({ page }) => {
  await page.route('**/api/expenses/*/category', (route) =>
    route.fulfill({ status: 500 })
  );
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expenseItem(page, 'Migros Zurich')
    .getByRole('button', { name: 'Change category: Groceries' })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Restaurants' })
    .click();

  await expect(page.getByText('Failed to update category')).toBeVisible();
  await expect.poll(migrosCategory).toBe('Groceries');
});

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('assigns a category with touch', async ({ page }) => {
    await page.goto('/');
    await selectMonth(page, 'Jul 2026');

    await expenseItem(page, 'Migros Zurich')
      .getByRole('button', { name: 'Change category: Groceries' })
      .tap();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Restaurants' })
      .tap();

    await expect(expenseItem(page, 'Migros Zurich')).toContainText(
      'Restaurants'
    );
  });
});
