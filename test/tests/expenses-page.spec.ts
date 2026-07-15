import { join } from 'path';
import { test, expect } from '../fixtures';
import { getExpenses } from '../utils';

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
  await expect(page.getByRole('cell', { name: 'Migros Zurich' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Groceries' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '42.5 CHF' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'SBB Ticket' })).toBeVisible();
});

test('displays AI-generated spending insight', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('You spent the most on Groceries this month.')).toBeVisible();
});

test('imports expenses from account statement upload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('cell', { name: 'Migros Zurich' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(join(__dirname, '../files/account-statement.csv'));

  await expect(page.getByRole('cell', { name: 'Coffee Shop' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '25.9 CHF' })).toBeVisible();
});

test('imports credit transactions as income', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('cell', { name: 'Migros Zurich' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(join(__dirname, '../files/account-statement.csv'));

  await expect(page.getByRole('cell', { name: 'Tax Refund' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Income' })).toBeVisible();
});

test('imports expenses from card statement upload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('cell', { name: 'Migros Zurich' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(join(__dirname, '../files/card-statement.csv'));

  await expect(page.getByRole('cell', { name: 'Coop Pronto' })).toBeVisible();
});

test('skips duplicate expenses on repeated upload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('cell', { name: 'Migros Zurich' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(join(__dirname, '../files/account-statement.csv'));
  await expect(page.getByRole('cell', { name: 'Coffee Shop' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(join(__dirname, '../files/account-statement.csv'));
  await expect(page.getByRole('cell', { name: 'Coffee Shop' })).toBeVisible();

  await expect.poll(async () => {
    const expenses = await getExpenses();
    return expenses.filter((expense) => expense.description === 'Coffee Shop').length;
  }).toBe(1);
});
