import { test, expect } from '../fixtures';
import { getSettings, insertExpense, query, setClosingDay } from '../utils';

test('opens the budget tab by default and saves a budget that survives reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Budget burndown' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('link', { name: 'Set a monthly budget in Settings' }).click();
  const budget = page.getByRole('spinbutton', { name: 'Monthly budget' });
  await expect(budget).toHaveValue('0');
  await budget.fill('100.25');
  await page.getByRole('button', { name: 'Update budget' }).click();
  await expect(page.getByText('Monthly budget saved')).toBeVisible();
  await page.reload();
  await expect(budget).toHaveValue('100.25');
  await page.getByRole('spinbutton', { name: 'Closing day' }).fill('16');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Closing day saved')).toBeVisible();
  expect((await getSettings()).monthly_budget).toBe('100.25');
});

test('validates budget amounts and reports save failures', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Set a monthly budget in Settings' }).click();
  const budget = page.getByRole('spinbutton', { name: 'Monthly budget' });
  const save = page.getByRole('button', { name: 'Update budget' });
  for (const value of ['', '-1', '1.001', '1000000000']) {
    await budget.fill(value);
    await expect(save).toBeDisabled();
  }
  await page.route('**/api/settings', (route) => route.request().method() === 'PUT'
    ? route.fulfill({ status: 500 }) : route.fallback());
  await budget.fill('100');
  await save.click();
  await expect(page.getByText('Failed to save monthly budget')).toBeVisible();
  expect((await getSettings()).monthly_budget).toBe('0.00');
});

test('includes converted and uncategorized spending, excludes income, and shows overspending', async ({ page }) => {
  await query('UPDATE expensetracker.settings SET monthly_budget = 100');
  await insertExpense('2026-07-10T10:00:00Z', 'Foreign purchase', '', 200, 'EUR', 'Card payment', 'Expense', 80, 'CHF');
  await insertExpense('2026-07-10T10:00:00Z', 'Salary', 'Income', 2000, 'CHF', 'Transfer', 'Income');
  await page.goto('/');
  await page.getByRole('radio', { name: 'Jul 2026' }).click();
  const chart = page.getByRole('region', { name: 'Monthly budget burndown' });
  await expect(chart.getByText('Budget remaining: -35.30 CHF')).toBeVisible();
  await expect(chart.getByRole('img', { name: /This is a chart/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Monthly spending', exact: true }).click();
  await page.getByRole('region', { name: 'Monthly spending by category' }).getByText('Transport', { exact: true }).click();
  await page.getByRole('tab', { name: 'Budget burndown' }).click();
  await expect(chart.getByText('Budget remaining: -35.30 CHF')).toBeVisible();
  await page.getByRole('radio', { name: 'All', exact: true }).click();
  await expect(chart.getByText('Select a month below to see its budget burndown.')).toBeVisible();
});

for (const invalidBudget of [-1, 0.001, 1000000000]) {
  test(`rejects invalid budget ${invalidBudget} on the server without changing settings`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Set a monthly budget in Settings' }).click();
    await page.route('**/api/settings', (route) => route.request().method() === 'PUT'
      ? route.continue({ postData: JSON.stringify({ closingDay: 16, monthlyBudget: invalidBudget }) })
      : route.fallback());
    await page.getByRole('spinbutton', { name: 'Monthly budget' }).fill('100');
    const response = page.waitForResponse((response) =>
      response.url().endsWith('/api/settings') && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Update budget' }).click();
    expect((await response).status()).toBe(400);
    expect(await getSettings()).toMatchObject({ closing_day: 31, monthly_budget: '0.00' });
  });
}

test('uses the selected closing period on mobile without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setClosingDay(16);
  await query('UPDATE expensetracker.settings SET monthly_budget = 100');
  await insertExpense('2026-07-16T10:00:00Z', 'Closing day', 'Groceries', 5, 'CHF', 'Card payment', 'Expense');
  await insertExpense('2026-07-17T10:00:00Z', 'Next period', 'Groceries', 20, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');
  await page.getByRole('radio', { name: 'Aug 2026' }).click();
  const chart = page.getByRole('region', { name: 'Monthly budget burndown' });
  await expect(chart.getByText('Budget remaining: 80.00 CHF')).toBeVisible();
  await expect(chart.getByText('Jul 17, 2026 – Aug 16, 2026 · Closing day: 16')).toBeVisible();
  await page.getByRole('radio', { name: 'Jul 2026' }).click();
  await expect(chart.getByText('Budget remaining: 39.70 CHF')).toBeVisible();
  await expect(chart.getByText('Jun 17, 2026 – Jul 16, 2026 · Closing day: 16')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test('updates the burndown period after changing the cutoff in Settings', async ({ page }) => {
  await query('UPDATE expensetracker.settings SET monthly_budget = 100');
  await insertExpense('2026-07-17T10:00:00Z', 'After cutoff', 'Groceries', 20, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');
  await page.getByRole('radio', { name: 'Jul 2026' }).click();
  const chart = page.getByRole('region', { name: 'Monthly budget burndown' });
  await expect(chart.getByText('Jul 1, 2026 – Jul 31, 2026 · Closing day: 31')).toBeVisible();
  await expect(chart.getByText('Budget remaining: 24.70 CHF')).toBeVisible();
  await page.getByRole('button', { name: 'TU' }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Closing day' }).fill('16');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Closing day saved')).toBeVisible();
  await page.goBack();
  await expect(chart.getByText('Jun 17, 2026 – Jul 16, 2026 · Closing day: 16')).toBeVisible();
  await expect(chart.getByText('Budget remaining: 44.70 CHF')).toBeVisible();
});
