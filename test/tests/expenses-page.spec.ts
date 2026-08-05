import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { insertExpense } from '../utils';

// The fixture seeds two expenses in July 2026 (Migros Zurich, SBB Ticket).
// The page defaults to the current month, so tests select the month they
// assert on explicitly.

const expenseItem = (page: Page, description: string) =>
  page.getByRole('listitem').filter({ hasText: description });

const selectMonth = async (page: Page, name: string) =>
  page.getByRole('radio', { name }).click();

const currentMonthLabel = () =>
  new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

// UTC noon on the 15th is inside the current local month in every timezone
const currentMonthDate = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), 15, 12)
  ).toISOString();
};

test('displays page title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Expenses');
});

test('displays app title in header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Expense Tracker' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Expense Tracker' })).toHaveAttribute('href', '/');
});

test('shows user initials in header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'TU' })).toBeVisible();
});

test('shows user name in popup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'TU' }).click();
  await expect(page.getByText('Test User')).toBeVisible();
});

test('shows current month transactions by default', async ({ page }) => {
  await insertExpense(currentMonthDate(), 'Bakery Today', 'Groceries', 5.5, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');
  await expect(page.getByRole('radio', { name: currentMonthLabel() })).toBeChecked();
  await expect(expenseItem(page, 'Bakery Today')).toBeVisible();
});

test('lists only transactions of the selected month', async ({ page }) => {
  await insertExpense('2026-06-15T10:00:00Z', 'Alps Hotel', 'Travel', 250, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');

  await selectMonth(page, 'Jun 2026');
  await expect(expenseItem(page, 'Alps Hotel')).toBeVisible();
  await expect(expenseItem(page, 'Migros Zurich')).not.toBeVisible();

  await selectMonth(page, 'Jul 2026');
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();
  await expect(expenseItem(page, 'Alps Hotel')).not.toBeVisible();
});

test('lists all transactions when All is selected', async ({ page }) => {
  await insertExpense('2026-06-15T10:00:00Z', 'Alps Hotel', 'Travel', 250, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');

  await selectMonth(page, 'All');
  await expect(expenseItem(page, 'Alps Hotel')).toBeVisible();
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();
  await expect(expenseItem(page, 'SBB Ticket')).toBeVisible();
});

test('displays expense details', async ({ page }) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  const migros = expenseItem(page, 'Migros Zurich');
  await expect(migros).toBeVisible();
  await expect(migros).toContainText('Groceries');
  await expect(migros).toContainText('Card payment');
  await expect(migros).toContainText('-42.50 CHF');
});

test('groups expenses by day with newest day first', async ({ page }) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expect(page.getByRole('heading', { name: 'Fri, Jul 3, 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wed, Jul 1, 2026' })).toBeVisible();
  const dayHeadings = page.getByRole('heading', { name: /2026$/ });
  await expect(dayHeadings.first()).toHaveText('Fri, Jul 3, 2026');
});

test('shows income with a plus sign', async ({ page }) => {
  await insertExpense('2026-07-12T10:00:00Z', 'Tax Refund', 'Taxes', 150, 'CHF', 'Direct payment', 'Income');
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await expect(expenseItem(page, 'Tax Refund')).toContainText('+150.00 CHF');
});

test('shows converted amount for foreign currency expenses', async ({ page }) => {
  await insertExpense('2026-07-06T10:00:00Z', 'Lidl Konstanz', 'Groceries', 20, 'EUR', 'Card payment', 'Expense', 19, 'CHF');
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  // Converted amount leads, original foreign amount stays visible
  const lidl = expenseItem(page, 'Lidl Konstanz');
  await expect(lidl).toContainText('-19.00 CHF');
  await expect(lidl).toContainText('20.00 EUR');
});

test('shows total spend next to the month filter', async ({ page }) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  // 42.50 (Migros Zurich) + 12.80 (SBB Ticket)
  await expect(page.getByText('Spent 55.30 CHF')).toBeVisible();
});

test('total spend follows the selected range and excludes income', async ({ page }) => {
  await insertExpense('2026-06-15T10:00:00Z', 'Alps Hotel', 'Travel', 250, 'CHF', 'Card payment', 'Expense');
  await insertExpense('2026-07-12T10:00:00Z', 'Tax Refund', 'Taxes', 150, 'CHF', 'Direct payment', 'Income');
  await page.goto('/');

  await selectMonth(page, 'Jun 2026');
  await expect(page.getByText('Spent 250.00 CHF')).toBeVisible();

  await selectMonth(page, 'Jul 2026');
  await expect(page.getByText('Spent 55.30 CHF')).toBeVisible();

  await selectMonth(page, 'All');
  await expect(page.getByText('Spent 305.30 CHF')).toBeVisible();
});

test('total spend uses converted amounts for foreign currency expenses', async ({ page }) => {
  await insertExpense('2026-07-06T10:00:00Z', 'Lidl Konstanz', 'Groceries', 20, 'EUR', 'Card payment', 'Expense', 19, 'CHF');
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  // 42.50 + 12.80 + 19.00 (converted from 20 EUR)
  await expect(page.getByText('Spent 74.30 CHF')).toBeVisible();
});

test('displays monthly spending by category chart', async ({ page }) => {
  await page.goto('/');
  const chartSection = page.getByRole('region', {
    name: 'Monthly spending by category',
  });
  await expect(
    chartSection.getByRole('heading', { name: 'Monthly spending by category' })
  ).toBeVisible();
  await expect(
    chartSection.getByRole('img', { name: /This is a chart/ })
  ).toBeVisible();
  await expect(chartSection.getByText('Groceries')).toBeVisible();
  await expect(chartSection.getByText('Transport')).toBeVisible();
  await expect(chartSection.getByText('Jul 2026')).toBeVisible();
});

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('fits chart, month filter and expenses without horizontal scrolling', async ({ page }) => {
    await page.goto('/');
    await selectMonth(page, 'All');
    await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Monthly spending by category' })
    ).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(horizontalOverflow).toBe(0);
  });
});
