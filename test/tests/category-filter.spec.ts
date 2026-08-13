import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { insertExpense } from '../utils';

// The fixture seeds two July 2026 expenses (Migros Zurich 42.50 Groceries,
// SBB Ticket 12.80 Transport) and the categories Groceries (🛒), Transport
// and Restaurants. The page defaults to the current month, so tests either
// select a month explicitly or let a chart pick do it.

const expenseItem = (page: Page, description: string) =>
  page.getByRole('listitem').filter({ hasText: description });

const selectMonth = async (page: Page, name: string) =>
  page.getByRole('radio', { name }).click();

const chart = (page: Page) =>
  page.getByRole('region', { name: 'Monthly spending by category' });

const chartCanvas = (page: Page) =>
  chart(page).getByRole('img', { name: /This is a chart/ });

const legendItem = (page: Page, category: string) =>
  chart(page).getByText(category, { exact: true });

const tooltipRow = (page: Page, category: string) =>
  page.locator('.chart-tooltip-row').filter({ hasText: category });

const filterChip = (page: Page, category: string) =>
  page.getByRole('button', { name: `Clear category filter: ${category}` });

// Opens the axis tooltip over the month at the given share of the chart width
const showTooltip = async (page: Page, widthShare = 0.5) => {
  const box = (await chartCanvas(page).boundingBox())!;
  await page.mouse.move(box.x + box.width * widthShare, box.y + box.height - 60);
};

test('filters the list by clicking a category in the chart tooltip', async ({
  page,
}) => {
  await insertExpense('2026-07-08T10:00:00Z', 'Coop Bern', 'Groceries', 8.2, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');

  await showTooltip(page);
  await tooltipRow(page, 'Transport').click();

  await expect(filterChip(page, 'Transport')).toBeVisible();
  await expect(expenseItem(page, 'SBB Ticket')).toBeVisible();
  await expect(expenseItem(page, 'Migros Zurich')).toHaveCount(0);
  await expect(expenseItem(page, 'Coop Bern')).toHaveCount(0);
});

test('filters the list by clicking a bar segment in the chart', async ({
  page,
}) => {
  await page.goto('/');

  // Groceries is the bottom series of the stack and holds 42.50 of the 55.30
  // July total, so a point just above the x-axis is inside its segment
  const box = (await chartCanvas(page).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 45);

  await expect(filterChip(page, 'Groceries')).toBeVisible();
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();
  await expect(expenseItem(page, 'SBB Ticket')).toHaveCount(0);
});

test('filters the list by clicking a category in the chart legend', async ({
  page,
}) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await legendItem(page, 'Transport').click();

  await expect(filterChip(page, 'Transport')).toBeVisible();
  await expect(expenseItem(page, 'SBB Ticket')).toBeVisible();
  await expect(expenseItem(page, 'Migros Zurich')).toHaveCount(0);
  // The legend filters the list instead of hiding the series from the chart
  await expect(legendItem(page, 'Groceries')).toBeVisible();
});

test('picking a category in the chart also selects its month', async ({
  page,
}) => {
  await insertExpense('2026-06-15T10:00:00Z', 'Alps Hotel', 'Travel', 250, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');
  await expect(expenseItem(page, 'Alps Hotel')).toHaveCount(0);

  // June is the left of the two months
  await showTooltip(page, 0.3);
  await tooltipRow(page, 'Travel').click();

  await expect(page.getByRole('radio', { name: 'Jun 2026' })).toBeChecked();
  await expect(expenseItem(page, 'Alps Hotel')).toBeVisible();
});

test('shows the filtered category with its emoji, count and total', async ({
  page,
}) => {
  await insertExpense('2026-07-08T10:00:00Z', 'Coop Bern', 'Groceries', 8.2, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');

  await legendItem(page, 'Groceries').click();

  const chip = filterChip(page, 'Groceries');
  await expect(chip).toContainText('🛒');
  await expect(chip).toContainText('Groceries');
  await expect(page.getByText('2 transactions')).toBeVisible();
  // 42.50 (Migros Zurich) + 8.20 (Coop Bern)
  await expect(page.getByText('Spent 50.70 CHF')).toBeVisible();
});

test('clears the category filter from the chip', async ({ page }) => {
  await page.goto('/');
  await selectMonth(page, 'Jul 2026');
  await legendItem(page, 'Transport').click();
  await expect(expenseItem(page, 'Migros Zurich')).toHaveCount(0);

  await filterChip(page, 'Transport').click();

  await expect(filterChip(page, 'Transport')).toHaveCount(0);
  await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();
  await expect(expenseItem(page, 'SBB Ticket')).toBeVisible();
});

test('hides uncategorized transactions while a category is selected', async ({
  page,
}) => {
  await insertExpense('2026-07-20T10:00:00Z', 'Unknown Shop', '', 9.9, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');
  const uncategorized = page.getByRole('region', { name: 'Uncategorized' });
  await expect(uncategorized).toBeVisible();

  await legendItem(page, 'Transport').click();
  await expect(uncategorized).toHaveCount(0);

  await filterChip(page, 'Transport').click();
  await expect(uncategorized).toBeVisible();
});

test('tells that the selected category has no transactions in the month', async ({
  page,
}) => {
  await insertExpense('2026-06-15T10:00:00Z', 'Alps Hotel', 'Travel', 250, 'CHF', 'Card payment', 'Expense');
  await page.goto('/');

  await legendItem(page, 'Travel').click();
  await selectMonth(page, 'Jul 2026');

  await expect(
    page.getByText('No Travel transactions in Jul 2026.')
  ).toBeVisible();
});

test.describe('URL', () => {
  test('keeps the selected filters in the URL', async ({ page }) => {
    await page.goto('/');
    await selectMonth(page, 'Jul 2026');

    await legendItem(page, 'Transport').click();

    await expect(page).toHaveURL(/[?&]category=Transport(&|$)/);
    await expect(page).toHaveURL(/[?&]month=2026-07(&|$)/);
  });

  test('restores the filters from the URL', async ({ page }) => {
    await insertExpense('2026-06-15T10:00:00Z', 'Alps Hotel', 'Travel', 250, 'CHF', 'Card payment', 'Expense');
    await page.goto('/?month=2026-06&category=Travel');

    await expect(filterChip(page, 'Travel')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Jun 2026' })).toBeChecked();
    await expect(expenseItem(page, 'Alps Hotel')).toBeVisible();
    await expect(expenseItem(page, 'Migros Zurich')).toHaveCount(0);
  });

  test('drops the category from the URL when the filter is cleared', async ({
    page,
  }) => {
    await page.goto('/?month=2026-07&category=Transport');

    await filterChip(page, 'Transport').click();

    await expect(page).not.toHaveURL(/category=/);
    await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();
  });

  test('goes back to the unfiltered list with the back button', async ({
    page,
  }) => {
    await page.goto('/');
    await selectMonth(page, 'Jul 2026');
    await legendItem(page, 'Transport').click();
    await expect(filterChip(page, 'Transport')).toBeVisible();

    await page.goBack();

    await expect(filterChip(page, 'Transport')).toHaveCount(0);
    await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();
  });
});

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('filters by tapping a bar segment and clears with the chip', async ({
    page,
  }) => {
    await page.goto('/');

    const box = (await chartCanvas(page).boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height - 40);

    const chip = filterChip(page, 'Groceries');
    await expect(chip).toBeVisible();
    await expect(expenseItem(page, 'Migros Zurich')).toBeVisible();
    await expect(expenseItem(page, 'SBB Ticket')).toHaveCount(0);

    // Comfortable tap target, and the filtered page never scrolls sideways
    const chipBox = (await chip.boundingBox())!;
    expect(chipBox.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
    ).toBe(0);

    await chip.tap();
    await expect(expenseItem(page, 'SBB Ticket')).toBeVisible();
  });

  test('filters by tapping a category in the chart tooltip', async ({
    page,
  }) => {
    // A tall June bar leaves empty space above the July bars, so the tooltip
    // can be opened without tapping a segment
    await insertExpense('2026-06-15T10:00:00Z', 'Alps Hotel', 'Travel', 250, 'CHF', 'Card payment', 'Expense');
    await page.goto('/');

    const box = (await chartCanvas(page).boundingBox())!;
    await page.touchscreen.tap(box.x + box.width * 0.75, box.y + 90);

    const row = tooltipRow(page, 'Transport');
    await expect(row).toBeVisible();
    const rowBox = (await row.boundingBox())!;
    expect(rowBox.height).toBeGreaterThanOrEqual(44);
    // The tooltip stays inside the phone screen
    expect(rowBox.x).toBeGreaterThanOrEqual(0);
    expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(390);

    await page.touchscreen.tap(
      rowBox.x + rowBox.width / 2,
      rowBox.y + rowBox.height / 2
    );

    await expect(filterChip(page, 'Transport')).toBeVisible();
    await expect(expenseItem(page, 'SBB Ticket')).toBeVisible();
    await expect(expenseItem(page, 'Migros Zurich')).toHaveCount(0);
  });
});
