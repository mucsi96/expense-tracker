import { test, expect } from '@playwright/test';

// The app shell must never be cached: it references the content-hashed
// bundles, so a stale copy (e.g. on an iOS home-screen app) pins the client
// to an old version of the app.

test('serves the app shell with no-cache', async ({ request }) => {
  for (const path of ['/', '/index.html', '/settings/categories']) {
    const response = await request.get(path, { headers: { Accept: 'text/html' } });
    expect(response.ok()).toBe(true);
    expect(response.headers()['cache-control'], path).toContain('no-store');
  }
});

test('serves hashed bundles as long-lived immutable assets', async ({
  request,
}) => {
  const html = await (await request.get('/')).text();
  const scriptSrc = html.match(/src="([^"]+\.js)"/)?.[1];
  expect(scriptSrc).toBeDefined();

  const response = await request.get(`/${scriptSrc}`);
  expect(response.ok()).toBe(true);
  expect(response.headers()['cache-control']).toContain('immutable');
});
