import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { query } from '../utils';

const exec = promisify(execFile);

test('adopts a populated previous-release database without changing data or sequences', async () => {
  test.setTimeout(120_000);
  const database = 'expense_tracker_upgrade_test';
  await query(`CREATE DATABASE ${database}`);
  const pool = new Pool({ host: 'localhost', port: Number(process.env.TEST_DB_PORT ?? 5461), database, user: 'postgres', password: 'postgres' });
  const tables = ['expenses', 'categories', 'merchant_categories', 'settings', 'databasechangelog', 'databasechangeloglock'];
  const snapshot = async () => Promise.all(tables.map(async table =>
    (await pool.query(`SELECT * FROM expensetracker.${table} ORDER BY id`)).rows));
  const sequences = async () => (await pool.query("SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'expensetracker' ORDER BY sequencename")).rows;
  try {
    await pool.query(await readFile('fixtures/previous-schema.sql', 'utf8'));
    const before = await snapshot();
    const beforeSequences = await sequences();
    for (let start = 0; start < 2; start++) {
      await exec('podman', [
        'run', '--rm', '--pod', 'expense-tracker-test',
        '-e', 'LOCO_ENV=test', '-e', `DATABASE_URL=postgres://postgres:postgres@localhost:5432/${database}`,
        '-e', 'OIDC_ISSUER=http://localhost:8060/default', '-e', 'API_CLIENT_ID=mock-api-client-id',
        '-e', 'BANK_NOTIFICATION_TOKEN=test-bank-notification-token', '-e', 'EXCHANGE_RATE_API_URL=http://localhost:8065/v1',
        'localhost/expense-tracker-server:test', 'db', 'migrate',
      ], { timeout: 45_000 });
      expect(await snapshot()).toEqual(before);
      expect(await sequences()).toEqual(beforeSequences);
    }
    const result = await pool.query("INSERT INTO expensetracker.categories (name) VALUES ('After upgrade') RETURNING id");
    expect(result.rows[0].id).toBe('501');
  } finally {
    await pool.end();
    await query(`DROP DATABASE ${database} WITH (FORCE)`);
  }
});
