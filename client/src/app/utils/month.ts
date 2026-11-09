// A monthly period ends on the closing day: transactions after it belong to
// the next month, and the period is named after the month it closes in. A
// closing day of 31 covers every month end, i.e. plain calendar months.

const formatMonthKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`;

const monthKeyFor = (
  year: number,
  month: number,
  day: number,
  closingDay: number
): string =>
  day <= closingDay
    ? formatMonthKey(year, month)
    : month === 12
    ? formatMonthKey(year + 1, 1)
    : formatMonthKey(year, month + 1);

export const toMonthKey = (date: string, closingDay: number): string => {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return monthKeyFor(year, month, day, closingDay);
};

export const currentMonthKey = (closingDay: number): string => {
  const now = new Date();
  return monthKeyFor(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    closingDay
  );
};

export const toMonthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};
