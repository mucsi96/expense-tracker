import { test as base, TestInfo } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { cleanupDb, insertCategory, insertExpense } from './utils';

export const test = base.extend<{ apiHeaders: Record<string, string> }>({
  apiHeaders: async ({ request }, use) => {
    const issuer = `${process.env.TEST_OIDC_URL ?? 'http://localhost:8060'}/default`;
    const redirect = 'http://localhost/test';
    const authorization = await request.get(`${issuer}/authorize`, {
      // Keep token issuer claims aligned with the API's in-pod issuer even
      // when the host port used to reach the mock is remapped.
      headers: { Host: 'localhost:8060' },
      params: { client_id: 'test-client', redirect_uri: redirect, response_type: 'code' },
      maxRedirects: 0,
    });
    const code = new URL(authorization.headers()['location']).searchParams.get('code')!;
    const tokens = await request.post(`${issuer}/token`, {
      headers: { Host: 'localhost:8060' },
      form: { grant_type: 'authorization_code', client_id: 'test-client', redirect_uri: redirect, code },
    });
    if (!tokens.ok()) throw new Error(`Mock token request failed: ${tokens.status()}`);
    await use({ Authorization: `Bearer ${(await tokens.json()).access_token}` });
  },
  page: async ({ page, apiHeaders }, use, testInfo: TestInfo) => {
    await cleanupDb();
    await insertExpense('2026-07-01T10:00:00Z', 'Migros Zurich', 'Groceries', 42.5, 'CHF', 'Card payment', 'Expense');
    await insertExpense('2026-07-03T10:00:00Z', 'SBB Ticket', 'Transport', 12.8, 'CHF', 'Direct payment', 'Expense');
    await insertCategory('Groceries', '🛒', 'Migros, Coop, Aldi, Lidl');
    await insertCategory('Transport');
    await insertCategory('Restaurants');

    // Stand in for the gateway; backend JWT/role and CSRF validation remain real.
    await page.route('**/api/**', route => route.continue({ headers: { ...route.request().headers(), ...apiHeaders } }));
    await page.route('**/oauth2/userinfo', route => route.fulfill({ json: { email: 'test-user@example.com', additionalClaims: { name: 'Test User' } } }));
    await page.route('**/_telemetry/collect', route => route.fulfill({ status: 202, body: 'ok' }));

    // Capture browser console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      const timestamp = new Date().toISOString();
      consoleLogs.push(
        `[${timestamp}] [${type.toUpperCase()}] ${text} (${location.url}:${location.lineNumber})`
      );
    });

    page.on('pageerror', (error) => {
      const timestamp = new Date().toISOString();
      consoleLogs.push(`[${timestamp}] [PAGE_ERROR] ${error.message}\n${error.stack}`);
    });

    // Now expose the page to tests
    await use(page);

    // Save console logs on test failure
    if (testInfo.status !== testInfo.expectedStatus && consoleLogs.length > 0) {
      const outputDir = testInfo.outputDir;
      mkdirSync(outputDir, { recursive: true });
      const logPath = join(outputDir, 'console-logs.txt');
      writeFileSync(logPath, consoleLogs.join('\n'));
      testInfo.attachments.push({
        name: 'console-logs',
        path: logPath,
        contentType: 'text/plain',
      });
    }
  },
});

export { expect } from '@playwright/test';
