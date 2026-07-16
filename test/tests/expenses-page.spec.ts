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
  await expect(page.getByRole('gridcell', { name: 'Migros Zurich' })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'Groceries' })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: '42.5 CHF' })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'SBB Ticket' })).toBeVisible();
});

test('displays AI-generated spending insight', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('You spent the most on Groceries this month.')).toBeVisible();
});

test('imports expenses from account statement dropped on the grid', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('gridcell', { name: 'Migros Zurich' })).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/account-statement.csv'));

  await expect(page.getByRole('gridcell', { name: 'Coffee Shop' })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: '25.9 CHF' })).toBeVisible();
});

test('imports credit transactions as income', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('gridcell', { name: 'Migros Zurich' })).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/account-statement.csv'));

  await expect(page.getByRole('gridcell', { name: 'Tax Refund' })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'Income' })).toBeVisible();
});

test('imports expenses from card statement dropped on the grid', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('gridcell', { name: 'Migros Zurich' })).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/card-statement.csv'));

  await expect(page.getByRole('gridcell', { name: 'Coop Pronto' })).toBeVisible();
});

test('imports multiple statements dropped together', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('gridcell', { name: 'Migros Zurich' })).toBeVisible();

  await dropStatements(
    page,
    join(__dirname, '../files/account-statement.csv'),
    join(__dirname, '../files/card-statement.csv')
  );

  await expect(page.getByRole('gridcell', { name: 'Coffee Shop' })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'Coop Pronto' })).toBeVisible();
});

test('shows notification about successful upload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('gridcell', { name: 'Migros Zurich' })).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/account-statement.csv'));

  await expect(
    page.getByText('2 expense(s) imported from account-statement.csv')
  ).toBeVisible();
});

test('skips summary rows from card statement upload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('gridcell', { name: 'Migros Zurich' })).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/card-statement.csv'));

  await expect(page.getByRole('gridcell', { name: 'Coop Pronto' })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'Total per currency' })).not.toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'Total card bookings' })).not.toBeVisible();
});

test('skips duplicate expenses on repeated upload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('gridcell', { name: 'Migros Zurich' })).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/account-statement.csv'));
  await expect(page.getByRole('gridcell', { name: 'Coffee Shop' })).toBeVisible();

  await dropStatements(page, join(__dirname, '../files/account-statement.csv'));
  await expect(page.getByRole('gridcell', { name: 'Coffee Shop' })).toBeVisible();

  await expect.poll(async () => {
    const expenses = await getExpenses();
    return expenses.filter((expense) => expense.description === 'Coffee Shop').length;
  }).toBe(1);
});
