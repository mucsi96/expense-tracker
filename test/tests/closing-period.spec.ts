import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { getSettings, insertExpense, setClosingDay } from '../utils';

// The fixture seeds two July 2026 expenses (Migros Zurich on Jul 1, SBB
// Ticket on Jul 3) and resets the closing day to 31 (calendar months). A
// closing day of 16 puts transactions from the 17th onward into the next
// month's period.

const expenseItem = (page: Page, description: string) =>
  page.getByRole('listitem').filter({ hasText: description });

const selectMonth = async (page: Page, name: string) =>
  page.getByRole('radio', { name }).click();

const openSettings = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByRole('button', { name: 'TU' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
};

const closingDayInput = (page: Page) =>
  page.getByRole('spinbutton', { name: 'Closing day' });

test('shows the stored closing day in settings', async ({ page }) => {
  await openSettings(page);

  await expect(
    page.getByRole('heading', { name: 'Monthly closing day' })
  ).toBeVisible();
  await expect(closingDayInput(page)).toHaveValue('31');
});

test('saves the closing day', async ({ page }) => {
  await openSettings(page);

  await closingDayInput(page).fill('16');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Closing day saved')).toBeVisible();
  await expect
    .poll(async () => {
      const settings = await getSettings();
      return settings.closing_day;
    })
    .toBe(16);
});

test('does not save a closing day outside 1-31', async ({ page }) => {
  await openSettings(page);

  await closingDayInput(page).fill('0');
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

  await closingDayInput(page).fill('32');
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('shows error notification when saving the closing day fails', async ({
  page,
}) => {
  await page.route('**/api/settings', (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({ status: 500 })
      : route.fallback()
  );
  await openSettings(page);

  await closingDayInput(page).fill('16');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Failed to save closing day')).toBeVisible();
});

test('groups transactions after the closing day into the next month', async ({
  page,
}) => {
  await setClosingDay(16);
  await insertExpense('2026-07-20T10:00:00Z', 'Late July Dinner', 'Restaurants', 35, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');

  // Jul 20 is after the closing day, so it belongs to the Aug 2026 period
  await selectMonth(page, 'Aug 2026');
  await expect(expenseItem(page, 'Late July Dinner')).toBeVisible();
  await expect(expenseItem(page, 'Migros Zurich')).not.toBeVisible();
  await expect(page.getByText('Spent 35.00 CHF')).toBeVisible();

  // The seeded Jul 1 and Jul 3 expenses stay in the Jul 2026 period
  await selectMonth(page, 'Jul 2026');
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();
  await expect(expenseItem(page, 'SBB Ticket')).toBeVisible();
  await expect(expenseItem(page, 'Late July Dinner')).not.toBeVisible();
  await expect(page.getByText('Spent 55.30 CHF')).toBeVisible();
});

test('groups chart spending by the closing period', async ({ page }) => {
  await setClosingDay(16);
  await insertExpense('2026-07-20T10:00:00Z', 'Late July Dinner', 'Restaurants', 35, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');

  const chartSection = page.getByRole('region', {
    name: 'Monthly spending by category',
  });
  await expect(chartSection.getByText('Jul 2026')).toBeVisible();
  await expect(chartSection.getByText('Aug 2026')).toBeVisible();
});

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('saves the closing day without horizontal overflow', async ({ page }) => {
    await openSettings(page);

    await closingDayInput(page).fill('16');

    const saveButton = page.getByRole('button', { name: 'Save' });
    const buttonBox = (await saveButton.boundingBox())!;
    expect(buttonBox.height).toBeGreaterThanOrEqual(44);

    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(horizontalOverflow).toBe(0);

    await saveButton.tap();
    await expect(page.getByText('Closing day saved')).toBeVisible();
    await expect
      .poll(async () => {
        const settings = await getSettings();
        return settings.closing_day;
      })
      .toBe(16);
  });
});
