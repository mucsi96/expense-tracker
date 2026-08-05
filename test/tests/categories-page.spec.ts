import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { getCategories, getExpenses } from '../utils';

// The fixture seeds the categories Groceries (with 🛒 emoji and a
// description), Transport and Restaurants. Signing in always returns to the
// home route, so the tests reach the categories page through the UI instead
// of a direct deep link.

const categoryItem = (page: Page, name: string) =>
  page.getByRole('listitem').filter({ hasText: name });

const openCategories = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByRole('button', { name: 'TU' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Manage categories' }).click();
};

test('navigates to categories from settings', async ({ page }) => {
  await openCategories(page);

  await expect(page).toHaveTitle('Categories');
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
});

test('lists categories alphabetically', async ({ page }) => {
  await openCategories(page);

  await expect(page.getByRole('listitem')).toHaveText([
    /Groceries/,
    /Restaurants/,
    /Transport/,
  ]);
});

test('adds a category', async ({ page }) => {
  await openCategories(page);

  await page.getByRole('textbox', { name: 'New category' }).fill('Health');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByText('Category added')).toBeVisible();
  await expect(categoryItem(page, 'Health')).toBeVisible();
  await expect
    .poll(async () =>
      (await getCategories()).map((category) => category.name)
    )
    .toContain('Health');
});

test('shows the category emoji and description', async ({ page }) => {
  await openCategories(page);

  const groceries = categoryItem(page, 'Groceries');
  await expect(groceries).toContainText('🛒');
  await expect(groceries).toContainText('Migros, Coop, Aldi, Lidl');
});

test('adds a category with emoji and description', async ({ page }) => {
  await openCategories(page);

  await page.getByRole('textbox', { name: 'Emoji' }).fill('💊');
  await page.getByRole('textbox', { name: 'New category' }).fill('Health');
  await page
    .getByRole('textbox', { name: 'Description' })
    .fill('DM, Müller, pharmacy');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByText('Category added')).toBeVisible();
  const health = categoryItem(page, 'Health');
  await expect(health).toContainText('💊');
  await expect(health).toContainText('DM, Müller, pharmacy');
  await expect
    .poll(async () =>
      (await getCategories()).find((category) => category.name === 'Health')
    )
    .toMatchObject({ emoji: '💊', description: 'DM, Müller, pharmacy' });
});

test('rejects a duplicate category', async ({ page }) => {
  await openCategories(page);

  await page.getByRole('textbox', { name: 'New category' }).fill('Groceries');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByText('Failed to add category')).toBeVisible();
  await expect.poll(async () => (await getCategories()).length).toBe(3);
});

test('renames a category and its transactions', async ({ page }) => {
  await openCategories(page);

  await page.getByRole('button', { name: 'Edit Groceries' }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Name' })
    .fill('Food');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Category updated')).toBeVisible();
  await expect(categoryItem(page, 'Food')).toBeVisible();
  await expect(categoryItem(page, 'Groceries')).not.toBeVisible();
  await expect
    .poll(async () => {
      const expenses = await getExpenses();
      return expenses.find(
        (expense) => expense.description === 'Migros Zurich'
      )?.category;
    })
    .toBe('Food');
});

test('edits the emoji and description of a category', async ({ page }) => {
  await openCategories(page);

  await page.getByRole('button', { name: 'Edit Transport' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Emoji' }).fill('🚗');
  await dialog
    .getByRole('textbox', { name: 'Description' })
    .fill('fuel, parking, SBB');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Category updated')).toBeVisible();
  const transport = categoryItem(page, 'Transport');
  await expect(transport).toContainText('🚗');
  await expect(transport).toContainText('fuel, parking, SBB');
  await expect
    .poll(async () =>
      (await getCategories()).find((category) => category.name === 'Transport')
    )
    .toMatchObject({ emoji: '🚗', description: 'fuel, parking, SBB' });
});

test('deletes a category', async ({ page }) => {
  await openCategories(page);

  await page.getByRole('button', { name: 'Delete Restaurants' }).click();

  await expect(page.getByText('Category deleted')).toBeVisible();
  await expect(categoryItem(page, 'Restaurants')).not.toBeVisible();
  await expect
    .poll(async () =>
      (await getCategories()).map((category) => category.name)
    )
    .not.toContain('Restaurants');
});

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('fits the category list without horizontal scrolling', async ({
    page,
  }) => {
    await openCategories(page);
    await expect(categoryItem(page, 'Groceries')).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    expect(horizontalOverflow).toBe(0);
  });
});
