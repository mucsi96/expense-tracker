import type { Expense } from '../expense.service';

const DAY = 24 * 60 * 60 * 1000;
const closingDate = (year: number, month: number, closingDay: number): number =>
  Date.UTC(
    year,
    month,
    Math.min(closingDay, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())
  );

export function budgetBurndown(
  expenses: Expense[],
  monthKey: string,
  closingDay: number,
  budget: number,
  today: string
) {
  const [year, month] = monthKey.split('-').map(Number);
  const start = closingDate(year, month - 2, closingDay);
  const end = closingDate(year, month - 1, closingDay);
  const dayCount = (end - start) / DAY;
  // Day zero is the opening balance, before the first day of the period.
  const dates = Array.from({ length: dayCount + 1 }, (_, i) =>
    new Date(start + i * DAY).toISOString().slice(0, 10)
  );
  const spending = expenses.filter(
    (expense) =>
      expense.type === 'Expense' &&
      expense.date &&
      expense.convertedAmount != null &&
      expense.date.slice(0, 10) > dates[0] &&
      expense.date.slice(0, 10) <= dates[dayCount]
  );
  const remaining = dates.map((date) =>
    date > today
      ? null
      : budget - spending
          .filter((expense) => expense.date!.slice(0, 10) <= date)
          .reduce((sum, expense) => sum + expense.convertedAmount!, 0)
  );
  return {
    dates,
    remaining,
    ideal: dates.map((_, index) => budget * (1 - index / dayCount)),
  };
}
