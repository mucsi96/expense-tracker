import { test, expect } from '@playwright/test';
import { cleanupDb, getBankNotifications } from '../utils';

// Matches bank-notification-token in application-test.yml
const token = 'test-bank-notification-token';

const notification = {
  from: 'notify@bank.example',
  to: 'expenses@example.com',
  subject: 'Card payment notification',
  raw: 'From: notify@bank.example\r\nSubject: Card payment notification\r\n\r\nYou paid CHF 12.50 at Coffee Shop.',
};

test.beforeEach(async () => {
  await cleanupDb();
});

test('stores bank notification posted with the worker token', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: notification,
  });

  expect(response.status()).toBe(204);

  const notifications = await getBankNotifications();
  expect(notifications).toHaveLength(1);
  expect(notifications[0].from_address).toBe(notification.from);
  expect(notifications[0].to_address).toBe(notification.to);
  expect(notifications[0].subject).toBe(notification.subject);
  expect(notifications[0].raw).toBe(notification.raw);
  expect(notifications[0].received_at).not.toBeNull();
});

test('rejects bank notification without token', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    data: notification,
  });

  expect(response.status()).toBe(401);
  expect(await getBankNotifications()).toHaveLength(0);
});

test('rejects bank notification with wrong token', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: 'Bearer wrong-token' },
    data: notification,
  });

  expect(response.status()).toBe(401);
  expect(await getBankNotifications()).toHaveLength(0);
});

test('rejects bank notification without raw email content', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: { from: notification.from, to: notification.to, subject: notification.subject },
  });

  expect(response.status()).toBe(400);
  expect(await getBankNotifications()).toHaveLength(0);
});
