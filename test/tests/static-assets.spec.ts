import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test, expect } from '../fixtures';

test('loads deep links, lazy charts and styles from a separate asset origin', async ({ page, baseURL }) => {
  const directory = await mkdtemp(join(tmpdir(), 'expense-static-'));
  const appOrigin = new URL(baseURL!).origin;
  const types: Record<string, string> = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
  };
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url!, 'http://localhost').pathname;
      const data = await readFile(join(directory, 'assets', path));
      response.writeHead(200, {
        'Content-Type': types[extname(path)] ?? 'application/octet-stream',
        'Access-Control-Allow-Origin': appOrigin,
      });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing asset server address');
  const assetOrigin = `http://127.0.0.1:${address.port}`;
  // Chromium treats the intercepted document as public; allow this test's
  // loopback asset server. Normal cross-origin CORS checks remain enabled.
  await page.context().grantPermissions(['local-network-access'], { origin: appOrigin });
  const failures: string[] = [];
  const assets: string[] = [];
  page.on('requestfailed', (request) => failures.push(request.url()));
  page.on('request', (request) => {
    if (['script', 'stylesheet'].includes(request.resourceType())) assets.push(request.url());
  });
  try {
    await promisify(execFile)(process.execPath, [
      resolve('../scripts/prepare-client.mjs'),
      resolve('../client/dist'),
      directory,
      `${assetOrigin}/`,
      appOrigin,
    ]);
    const html = await readFile(join(directory, 'documents/index.html'), 'utf8');
    await page.route(`${appOrigin}/**`, (route) =>
      route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: html }) : route.fallback()
    );
    await page.goto('/settings/categories');
    await expect(page.getByRole('listitem').filter({ hasText: 'Groceries' })).toBeVisible();
    await page.getByRole('link', { name: 'Expense Tracker' }).click();
    await page.getByRole('tab', { name: 'Monthly spending', exact: true }).click();
    await expect(page.getByRole('img', { name: /This is a chart/ })).toBeVisible();
    await page.getByRole('button', { name: 'TU', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: 'Closing day' })).toHaveValue('31');
    expect(assets.length).toBeGreaterThan(5);
    expect(assets.every((url) => new URL(url).origin === assetOrigin)).toBe(true);
    expect(failures).toEqual([]);
    const manifest = JSON.parse(await readFile(join(directory, 'assets/manifest.webmanifest'), 'utf8'));
    expect(manifest.start_url).toBe(`${appOrigin}/`);
    expect(manifest.scope).toBe(`${appOrigin}/`);
    expect(
      await page
        .getByRole('link', { name: 'Expense Tracker' })
        .evaluate((element) => getComputedStyle(element).fontFamily)
    ).toContain('system-ui');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(directory, { recursive: true, force: true });
  }
});
