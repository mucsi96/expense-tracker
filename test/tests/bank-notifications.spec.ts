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

test('stores bank notification as expense', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: notification,
  });

  expect(response.status()).toBe(204);

  const expenses = await getExpenses();
  expect(expenses).toHaveLength(1);
  expect(expenses[0].description).toBe(notification.subject);
  expect(Number(expenses[0].amount)).toBe(12.5);
  expect(expenses[0].currency).toBe('CHF');
  expect(Number(expenses[0].converted_amount)).toBe(12.5);
  expect(expenses[0].base_currency).toBe('CHF');
  expect(expenses[0].method).toBe('Card payment');
  expect(expenses[0].type).toBe('Expense');
  expect(expenses[0].expense_date).not.toBeNull();
});

test('converts foreign currency notification to base currency', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...notification,
      subject: 'Card payment at Lidl Konstanz',
      raw: 'Your card was charged EUR 20.00 at Lidl Konstanz.',
    },
  });

  expect(response.status()).toBe(204);

  const expenses = await getExpenses();
  expect(expenses).toHaveLength(1);
  expect(Number(expenses[0].amount)).toBe(20);
  expect(expenses[0].currency).toBe('EUR');
  // Mock exchange rate server converts at 1 EUR = 0.95 CHF
  expect(Number(expenses[0].converted_amount)).toBe(19);
  expect(expenses[0].base_currency).toBe('CHF');
});

test('skips redelivered duplicate notification', async ({ request }) => {
  const post = () =>
    request.post('/api/bank-notifications', {
      headers: { Authorization: `Bearer ${token}` },
      data: notification,
    });

  expect((await post()).status()).toBe(204);
  expect((await post()).status()).toBe(204);

  expect(await getExpenses()).toHaveLength(1);
});

test('rejects bank notification without token', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    data: notification,
  });

  expect(response.status()).toBe(401);
  expect(await getExpenses()).toHaveLength(0);
});

test('rejects bank notification with wrong token', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: 'Bearer wrong-token' },
    data: notification,
  });

  expect(response.status()).toBe(401);
  expect(await getExpenses()).toHaveLength(0);
});

test('rejects bank notification without a recognizable amount', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...notification,
      subject: 'Security alert',
      raw: 'Your PIN was changed.',
    },
  });

  expect(response.status()).toBe(400);
  expect(await getExpenses()).toHaveLength(0);
});

test('rejects bank notification without raw email content', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: { from: notification.from, to: notification.to, subject: notification.subject },
  });

  expect(response.status()).toBe(400);
  expect(await getExpenses()).toHaveLength(0);
});
