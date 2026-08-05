import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { getCategories, getExpenses } from '../utils';

// The fixture seeds the categories Groceries, Transport and Restaurants.
// Signing in always returns to the home route, so the tests reach the
// categories page through the UI instead of a direct deep link.

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

test('rejects a duplicate category', async ({ page }) => {
  await openCategories(page);

  await page.getByRole('textbox', { name: 'New category' }).fill('Groceries');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByText('Failed to add category')).toBeVisible();
  await expect.poll(async () => (await getCategories()).length).toBe(3);
});

test('renames a category and its transactions', async ({ page }) => {
  await openCategories(page);

  await page.getByRole('button', { name: 'Rename Groceries' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Food');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Category renamed')).toBeVisible();
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
