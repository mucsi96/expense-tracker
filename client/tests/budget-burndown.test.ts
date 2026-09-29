import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetBurndown } from '../src/app/budget-burndown/budget-burndown.ts';
import type { Expense } from '../src/app/expense.service.ts';

const expense = (date: string, convertedAmount: number) => ({
  date, convertedAmount, type: 'Expense',
} as Expense);

test('starts at the budget, accumulates daily spending, and stops actuals at today', () => {
  const data = budgetBurndown([
    expense('2026-06-30', 500),
    expense('2026-07-01', 20),
    expense('2026-07-01', 5),
    expense('2026-07-03', 10),
    expense('2026-07-04', 50),
  ], '2026-07', 31, 100, '2026-07-03');
  assert.deepEqual(data.remaining.slice(0, 5), [100, 75, 75, 65, null]);
  assert.ok(data.remaining.slice(4).every((value) => value === null));
  assert.equal(data.ideal[0], 100);
  assert.equal(data.ideal.at(-1), 0);
});

test('clamps closing days at month end across leap years and year boundaries', () => {
  const leap = budgetBurndown([], '2024-03', 31, 100, '2024-04-01');
  assert.equal(leap.dates[0], '2024-02-29');
  assert.equal(leap.dates.at(-1), '2024-03-31');
  assert.deepEqual(leap.remaining, Array(32).fill(100));
  const february = budgetBurndown([], '2026-02', 30, 100, '2026-03-01');
  assert.equal(february.dates[0], '2026-01-30');
  assert.equal(february.dates.at(-1), '2026-02-28');
  const january = budgetBurndown([], '2026-01', 16, 100, '2026-01-31');
  assert.equal(january.dates[0], '2025-12-16');
  assert.equal(january.dates.at(-1), '2026-01-16');
});

test('shows only the ideal line for a future period', () => {
  const data = budgetBurndown([], '2026-12', 31, 100, '2026-10-01');
  assert.ok(data.remaining.every((value) => value === null));
  assert.equal(data.ideal[0], 100);
  assert.equal(data.ideal.at(-1), 0);
});
