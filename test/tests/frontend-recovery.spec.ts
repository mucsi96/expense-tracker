import { test, expect } from '../fixtures';
import { query } from '../utils';

test('preserves nullable legacy transactions at the API boundary', async ({ page }) => {
  await query('INSERT INTO expensetracker.expenses (description) VALUES ($1)', ['Legacy transaction']);
  await page.goto('/');
  const uncategorized = page.getByRole('region', { name: 'Uncategorized' });
  await expect(uncategorized.getByText('Legacy transaction')).toBeVisible();
  await expect(uncategorized.getByRole('heading', { name: 'Unknown date' })).toBeVisible();
  await page.getByRole('radio', { name: 'Jul 2026' }).click();
  await expect(page.getByText('Migros Zurich')).toBeVisible();
});

test('shows a loading skeleton and retries a failed expense request', async ({ page }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/expenses', async (route) => {
    await pending;
    await route.fulfill({ status: 500 });
  });
  await page.goto('/');
  await expect(page.getByRole('status', { name: 'Loading expenses' })).toBeVisible();
  release();
  await expect(page.getByText('Unable to load data.')).toBeVisible();
  await page.unroute('**/api/expenses');
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByRole('radio', { name: 'Jul 2026' }).click();
  await expect(page.getByText('Migros Zurich')).toBeVisible();
});

test('rejects malformed API data and recovers on retry', async ({ page }) => {
  await page.route('**/api/settings', (route) => route.fulfill({ json: { closingDay: '31' } }));
  await page.goto('/settings');
  await expect(page.getByText('Unable to load data.')).toBeVisible();
  await page.unroute('**/api/settings');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Closing day' })).toHaveValue('31');
});

test('supports chart tabs and the category picker with the keyboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Budget burndown' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Monthly spending', exact: true })).toBeFocused();
  await expect(page.getByRole('region', { name: 'Monthly spending by category' })).toBeVisible();
  await page.getByRole('radio', { name: 'Jul 2026' }).click();
  const trigger = page.getByRole('button', { name: 'Change category: Groceries' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('retries category loading without displaying an empty category list', async ({ page }) => {
  await page.route('**/api/categories', (route) => route.fulfill({ status: 503 }));
  await page.goto('/settings/categories');
  await expect(page.getByText('Unable to load data.')).toBeVisible();
  await page.unroute('**/api/categories');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Groceries' })).toBeVisible();
});
