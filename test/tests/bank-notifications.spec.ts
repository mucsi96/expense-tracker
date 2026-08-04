import { test, expect } from '@playwright/test';
import { cleanupDb, getExpenses } from '../utils';

// Matches bank-notification-token in application-test.yml
const token = 'test-bank-notification-token';

// Same shape as a real card debit notification (multipart/mixed with a
// quoted-printable HTML part carrying the transaction and a plain-text part
// holding only a legal disclaimer), but with a fake bank, addresses and card
// number throughout.
const buildRaw = ({ amount = 'CHF 12.50', merchant = 'COFFEE SHOP Z=C3=9CRICH' } = {}) =>
  [
    'Received: from mail.bank.example (203.0.113.10)',
    '        by email-forwarder.example (forwarder) id AbCdEf123456',
    '        for <expenses@user.example>; Tue, 04 Aug 2026 06:44:32 +0000',
    'Date: Tue, 4 Aug 2026 08:44:31 +0200',
    'From: Example Bank <noreply-alerting@bank.example>',
    'To: expenses@user.example',
    'Subject: Example Bank Digital Banking: Card debit',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="----=_notification"',
    '',
    '------=_notification',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    '<html><head><style type=3D"text/css">body { margin:0; }</style></head>',
    // Decoy money value outside the NOTIFICATION_CONTENT markers must not be
    // picked up as the amount
    '<body><div style=3D"display:none">Card debit - annual fee CHF 99.99</div>',
    '<table><tr><td>Hello,<br><br>',
    '<!-- NOTIFICATION_CONTENT_BEGIN -->',
    `${amount} have been charged to card "4242". ${merchant}. Available amount:=`,
    ' CHF 7=E2=80=99317.38.',
    '<!-- NOTIFICATION_CONTENT_END -->',
    '<br><br>Kind regards,<br>Example Bank AG</td></tr></table></body></html>',
    '------=_notification',
    'Content-Type: text/plain; charset=us-ascii; name="disclaim.txt"',
    'Content-Transfer-Encoding: 7bit',
    'Content-Disposition: inline',
    'Content-Description: Legal Disclaimer',
    '',
    'This message contains confidential information and is intended only',
    'for the individual named.',
    '------=_notification--',
  ].join('\r\n');

const notification = {
  from: 'noreply-alerting@bank.example',
  to: 'expenses@user.example',
  subject: 'Example Bank Digital Banking: Card debit',
  raw: buildRaw(),
};

test.beforeEach(async () => {
  await cleanupDb();
});

test('stores bank notification as card payment expense', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: notification,
  });

  expect(response.status()).toBe(204);

  const expenses = await getExpenses();
  expect(expenses).toHaveLength(1);
  expect(expenses[0]).toMatchObject({
    // Quoted-printable =C3=9C decoded to Ü
    description: 'COFFEE SHOP ZÜRICH',
    // numeric(19, 4) columns come back from pg as strings
    amount: '12.5000',
    currency: 'CHF',
    converted_amount: '12.5000',
    base_currency: 'CHF',
    method: 'Card payment',
    type: 'Expense',
  });
  // No date in the body, so the email's Date header (08:44:31 +0200) is used
  expect(new Date(expenses[0].expense_date).toISOString()).toBe('2026-08-04T06:44:31.000Z');
});

test('converts foreign amounts to the base currency', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...notification,
      raw: buildRaw({ amount: 'EUR 100.00', merchant: 'ARAL STATION PASSAU' }),
    },
  });

  expect(response.status()).toBe(204);

  const expenses = await getExpenses();
  expect(expenses).toHaveLength(1);
  expect(expenses[0]).toMatchObject({
    description: 'ARAL STATION PASSAU',
    amount: '100.0000',
    currency: 'EUR',
    // EUR -> CHF at the mock exchange rate server's 0.95
    converted_amount: '95.0000',
    base_currency: 'CHF',
  });
});

test('skips redelivery of the same notification as duplicate', async ({ request }) => {
  for (let i = 0; i < 2; i++) {
    const response = await request.post('/api/bank-notifications', {
      headers: { Authorization: `Bearer ${token}` },
      data: notification,
    });
    expect(response.status()).toBe(204);
  }

  expect(await getExpenses()).toHaveLength(1);
});

test('rejects notification in unrecognized format without storing', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...notification,
      subject: 'Example Bank Digital Banking: Security alert',
      raw: 'Date: Tue, 4 Aug 2026 08:44:31 +0200\r\nFrom: Example Bank <noreply-alerting@bank.example>\r\n\r\nYour one-time code is 123456.',
    },
  });

  expect(response.status()).toBe(422);
  expect(await getExpenses()).toHaveLength(0);
});

test('rejects notification without an HTML part', async ({ request }) => {
  // The transaction data is complete, but only in a plain-text part, which
  // the parser ignores
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...notification,
      raw: [
        'Date: Tue, 4 Aug 2026 08:44:31 +0200',
        'From: Example Bank <noreply-alerting@bank.example>',
        'Subject: Example Bank Digital Banking: Card debit',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        '',
        'Date: 04.08.2026 08:44:12',
        'Amount: CHF 12.50',
        'Merchant: COFFEE SHOP ZUERICH',
      ].join('\r\n'),
    },
  });

  expect(response.status()).toBe(422);
  expect(await getExpenses()).toHaveLength(0);
});

test('rejects notification without NOTIFICATION_CONTENT markers', async ({ request }) => {
  // The transaction data is complete, but not bracketed between the
  // NOTIFICATION_CONTENT markers
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      ...notification,
      raw: [
        'Date: Tue, 4 Aug 2026 08:44:31 +0200',
        'From: Example Bank <noreply-alerting@bank.example>',
        'Subject: Example Bank Digital Banking: Card debit',
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        '',
        '<html><body><p>CHF 12.50 have been charged to card "4242". COFFEE SHOP ZUERICH.</p></body></html>',
      ].join('\r\n'),
    },
  });

  expect(response.status()).toBe(422);
  expect(await getExpenses()).toHaveLength(0);
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
});

test('rejects bank notification without raw email content', async ({ request }) => {
  const response = await request.post('/api/bank-notifications', {
    headers: { Authorization: `Bearer ${token}` },
    data: { from: notification.from, to: notification.to, subject: notification.subject },
  });

  expect(response.status()).toBe(400);
});
