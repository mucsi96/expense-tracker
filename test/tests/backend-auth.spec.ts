import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
const container = `expense-auth-${randomUUID()}`;
let issuer: string;
let api: string;
const oidc = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(request.url === '/jwks'
    ? { keys: [jwk] }
    : { issuer, jwks_uri: `${issuer}/jwks` }));
});

function token(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: issuer, aud: 'auth-test-api', sub: 'test-user', exp: now + 3600,
    nbf: now - 10, scp: 'api-access', roles: ['readExpenses', 'createExpenses', 'deleteExpenses'],
    ...overrides,
  };
  const content = [
    { alg: 'RS256', typ: 'JWT', kid: 'test-key' }, claims,
  ].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  return `${content}.${sign('RSA-SHA256', Buffer.from(content), privateKey).toString('base64url')}`;
}

test.beforeAll(async ({ request }) => {
  await new Promise<void>(resolve => oidc.listen(0, '127.0.0.1', resolve));
  const address = oidc.address();
  if (!address || typeof address === 'string') throw new Error('Missing issuer port');
  issuer = `http://127.0.0.1:${address.port}`;
  const reserve = createServer();
  await new Promise<void>(resolve => reserve.listen(0, '127.0.0.1', resolve));
  const apiAddress = reserve.address();
  if (!apiAddress || typeof apiAddress === 'string') throw new Error('Missing API port');
  const port = apiAddress.port;
  await new Promise<void>((resolve, reject) => reserve.close(error => error ? reject(error) : resolve()));
  api = `http://127.0.0.1:${port}`;
  await exec('podman', [
    'run', '-d', '--name', container, '--network', 'host', '--read-only',
    '-e', 'LOCO_ENV=test', '-e', `PORT=${port}`, '-e', 'BINDING=127.0.0.1',
    '-e', `DATABASE_URL=postgres://postgres:postgres@localhost:${process.env.TEST_DB_PORT ?? 5461}/test`,
    '-e', `OIDC_ISSUER=${issuer}`, '-e', 'API_CLIENT_ID=auth-test-api',
    '-e', 'BANK_NOTIFICATION_TOKEN=auth-test-worker', '-e', 'EXCHANGE_RATE_API_URL=http://localhost:8065/v1',
    'localhost/expense-tracker-server:test',
  ]);
  await expect.poll(async () => {
    try { return (await request.get(`${api}/healthz`)).status(); } catch { return 0; }
  }, { timeout: 20_000 }).toBe(200);
});

test.afterAll(async () => {
  await exec('podman', ['rm', '-f', container]);
  await new Promise<void>((resolve, reject) => oidc.close(error => error ? reject(error) : resolve()));
});

for (const [name, claims, status] of [
  ['valid token', {}, 200],
  ['wrong audience', { aud: 'another-api' }, 401],
  ['wrong issuer', { iss: 'https://another-issuer.example' }, 401],
  ['expired', { exp: 1 }, 401],
  ['not yet valid', { nbf: 4102444800 }, 401],
  ['missing API scope', { scp: 'other-scope' }, 403],
  ['missing read role', { roles: ['createExpenses'] }, 403],
] as const) {
  test(`JWT authorization: ${name}`, async ({ request }) => {
    expect((await request.get(`${api}/api/expenses`, {
      headers: { Authorization: `Bearer ${token(claims)}` },
    })).status()).toBe(status);
  });
}

test('read-only roles cannot create, update or delete even with valid CSRF proof', async ({ request }) => {
  const csrf = randomUUID();
  const headers = {
    Authorization: `Bearer ${token({ roles: ['readExpenses'] })}`,
    Cookie: `__Host-XSRF-TOKEN=${csrf}`, 'X-XSRF-TOKEN': csrf,
  };
  expect((await request.post(`${api}/api/categories`, { headers, data: { name: 'Forbidden' } })).status()).toBe(403);
  expect((await request.put(`${api}/api/settings`, { headers, data: { closingDay: 15 } })).status()).toBe(403);
  expect((await request.delete(`${api}/api/expenses`, { headers })).status()).toBe(403);
});

test('JWT credentials cannot authenticate the email worker endpoint', async ({ request }) => {
  expect((await request.post(`${api}/api/bank-notifications`, {
    headers: { Authorization: `Bearer ${token()}` }, data: {},
  })).status()).toBe(401);
});
