import { test, expect } from '../fixtures';

test('boots a deep link without browser OAuth tokens or environment bootstrap', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  const telemetry = page.waitForRequest('**/_telemetry/collect');
  await page.goto('/settings/categories');
  await expect(page.getByRole('button', { name: 'TU', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Categories');
  expect((await telemetry).postDataJSON().meta.app.name).toBe('expense-tracker-client');
  expect(requests.some(url => /\/api\/environment|\/default\/(authorize|token)/.test(url))).toBe(false);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('oidc.')))).toEqual([]);
});

test('API independently rejects missing and forged credentials', async ({ request, apiHeaders }) => {
  expect((await request.get('/api/expenses')).status()).toBe(401);
  expect((await request.get('/api/expenses', { headers: { Authorization: 'Bearer forged' } })).status()).toBe(401);
  expect((await request.get('/api/expenses', { headers: apiHeaders })).status()).toBe(200);
  expect((await request.get('/api/environment', { headers: apiHeaders })).status()).toBe(404);
});

test('mutations require matching CSRF cookie and header even with gateway bearer credentials', async ({ page, context, request, apiHeaders }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'TU', exact: true })).toBeVisible();
  const cookie = (await context.cookies()).find(cookie => cookie.name === '__Host-XSRF-TOKEN');
  expect(cookie).toMatchObject({ path: '/', secure: true, httpOnly: false, sameSite: 'Lax' });
  const data = { name: 'CSRF proof category' };
  expect((await page.request.post('/api/categories', { headers: apiHeaders, data })).status()).toBe(403);
  expect((await page.request.post('/api/categories', { headers: { ...apiHeaders, 'X-XSRF-TOKEN': 'forged' }, data })).status()).toBe(403);
  const headers = { ...apiHeaders, 'X-XSRF-TOKEN': cookie!.value };
  expect((await request.post('/api/categories', { headers, data })).status()).toBe(403);
  expect((await page.request.post('/api/categories', { headers, data })).ok()).toBe(true);
});
