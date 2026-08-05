import { readFileSync } from 'fs';
import { basename, join } from 'path';
import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { getExpenses } from '../utils';

const dropStatements = async (page: Page, ...filePaths: string[]): Promise<void> => {
  const files = filePaths.map((filePath) => ({
    bytes: Array.from(readFileSync(filePath)),
    name: basename(filePath),
  }));
  const dataTransfer = await page.evaluateHandle((droppedFiles) => {
    const dt = new DataTransfer();
    droppedFiles.forEach(({ bytes, name }) =>
      dt.items.add(new File([new Uint8Array(bytes)], name, { type: 'text/csv' }))
    );
    return dt;
  }, files);
  await page.dispatchEvent('.dropzone', 'drop', { dataTransfer });
};

const expenseItem = (page: Page, description: string) =>
  page.getByRole('listitem').filter({ hasText: description });

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

test('displays expenses from database', async ({ page }) => {
  await page.goto('/');
  const migros = expenseItem(page, 'Migros Zurich');
  await expect(migros).toBeVisible();
  await expect(migros).toContainText('Groceries');
  await expect(migros).toContainText('-42.50 CHF');
  await expect(expenseItem(page, 'SBB Ticket')).toBeVisible();
});

test('groups expenses by day with newest day first', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fri, Jul 3, 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wed, Jul 1, 2026' })).toBeVisible();
  const headings = page.getByRole('heading', { name: /2026$/ });
  await expect(headings.first()).toHaveText('Fri, Jul 3, 2026');
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

test('imports expenses from account statement dropped on the expense list', async ({ page }) => {
  await page.goto('/');
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/account-statement.csv'));

  const coffeeShop = expenseItem(page, 'Coffee Shop');
  await expect(coffeeShop).toBeVisible();
  await expect(coffeeShop).toContainText('-25.90 CHF');
});

test('imports credit transactions as income', async ({ page }) => {
  await page.goto('/');
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/account-statement.csv'));

  const taxRefund = expenseItem(page, 'Tax Refund');
  await expect(taxRefund).toBeVisible();
  await expect(taxRefund).toContainText('+150.00 CHF');
});

test('imports expenses from card statement dropped on the expense list', async ({ page }) => {
  await page.goto('/');
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/card-statement.csv'));

  await expect(expenseItem(page, 'Coop Pronto')).toBeVisible();
});

test('preserves foreign currency and stores the converted amount', async ({ page }) => {
  await page.goto('/');
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/card-statement.csv'));

  // Converted amount leads, original foreign amount stays visible
  const lidl = expenseItem(page, 'Lidl Konstanz');
  await expect(lidl).toBeVisible();
  await expect(lidl).toContainText('-19.00 CHF');
  await expect(lidl).toContainText('20.00 EUR');
});

test('imports multiple statements dropped together', async ({ page }) => {
  await page.goto('/');
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();

  await dropStatements(
    page,
    join(__dirname, '../files/account-statement.csv'),
    join(__dirname, '../files/card-statement.csv')
  );

  await expect(expenseItem(page, 'Coffee Shop')).toBeVisible();
  await expect(expenseItem(page, 'Coop Pronto')).toBeVisible();
});

test('shows notification about successful upload', async ({ page }) => {
  await page.goto('/');
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/account-statement.csv'));

  await expect(
    page.getByText('2 expense(s) imported from account-statement.csv')
  ).toBeVisible();
});

test('skips summary rows from card statement upload', async ({ page }) => {
  await page.goto('/');
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/card-statement.csv'));

  await expect(expenseItem(page, 'Coop Pronto')).toBeVisible();
  await expect(page.getByText('Total per currency')).not.toBeVisible();
  await expect(page.getByText('Total card bookings')).not.toBeVisible();
});

test('skips duplicate expenses on repeated upload', async ({ page }) => {
  await page.goto('/');
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/account-statement.csv'));
  await expect(expenseItem(page, 'Coffee Shop')).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/account-statement.csv'));
  await expect(expenseItem(page, 'Coffee Shop')).toBeVisible();

  await expect.poll(async () => {
    const expenses = await getExpenses();
    return expenses.filter((expense) => expense.description === 'Coffee Shop').length;
  }).toBe(1);
});

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('fits expenses and chart without horizontal scrolling', async ({ page }) => {
    await page.goto('/');
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

  test('imports statement with the Import CSV button', async ({ page }) => {
    await page.goto('/');
    await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();

    const fileChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import CSV' }).click();
    await (await fileChooser).setFiles(
      join(__dirname, '../files/account-statement.csv')
    );

    await expect(expenseItem(page, 'Coffee Shop')).toBeVisible();
    await expect(
      page.getByText('2 expense(s) imported from account-statement.csv')
    ).toBeVisible();
  });
});
