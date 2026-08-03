import { test, expect } from '@playwright/test';
import { cleanupDb, getExpenses } from '../utils';

// Matches bank-notification-token in application-test.yml
const token = 'test-bank-notification-token';

const notification = {
  from: 'notify@bank.example',
  to: 'expenses@example.com',
  subject: 'Card payment at Coffee Shop',
  raw: 'From: notify@bank.example\r\n\r\nYour card was charged CHF 12.50 at Coffee Shop.',
};

test.beforeEach(async () => {
  await cleanupDb();
});

test('accepts bank notification posted with the worker token', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: notification,
  });

  expect(response.status()).toBe(204);
  // The notification is only logged for now, nothing is stored
  expect(await getExpenses()).toHaveLength(0);
});

test('rejects bank notification without token', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    data: notification,
  });

  expect(response.status()).toBe(401);
});

test('rejects bank notification with wrong token', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: 'Bearer wrong-token' },
    data: notification,
  });

  expect(response.status()).toBe(401);
});

test('rejects bank notification without raw email content', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: { from: notification.from, to: notification.to, subject: notification.subject },
  });

  expect(response.status()).toBe(400);
});
