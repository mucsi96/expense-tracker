import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { EChartsOption } from 'echarts';
import type { Expense, Settings } from '../api';
import { budgetBurndown } from '../domain/budget-burndown';
import { Chart } from './Chart';
import styles from './Chart.module.css';

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

export default function BudgetBurndown({
  expenses,
  settings,
  month,
}: {
  expenses: Expense[];
  settings: Settings;
  month: string;
}) {
  return (
    <section aria-label="Monthly budget burndown" className={styles.section}>
      <h2>Monthly budget burndown</h2>
      {month === 'all' ? (
        <p>Select a month below to see its budget burndown.</p>
      ) : !settings.monthlyBudget ? (
        <p>
          <Link to="/settings">Set a monthly budget in Settings</Link>
        </p>
      ) : (
        <BudgetChart expenses={expenses} settings={settings} month={month} />
      )}
    </section>
  );
}

function BudgetChart({ expenses, settings, month }: { expenses: Expense[]; settings: Settings; month: string }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const data = useMemo(
    () => budgetBurndown(expenses, month, settings.closingDay, settings.monthlyBudget, today),
    [expenses, month, settings.closingDay, settings.monthlyBudget, today]
  );
  const balance = data.remaining.filter((value) => value !== null).at(-1);
  const option = useMemo<EChartsOption>(
    () => ({
      aria: { enabled: true },
      animation: false,
      textStyle: { fontFamily: 'system-ui', color: '#e5e7eb' },
      legend: { top: 0, textStyle: { color: '#e5e7eb' } },
      tooltip: {
        trigger: 'axis',
        confine: true,
        valueFormatter: (value) => `${Number(value).toFixed(2)} ${settings.baseCurrency}`,
      },
      grid: { top: 60, right: 16, bottom: 16, left: 12, containLabel: true },
      xAxis: {
        type: 'category',
        data: data.dates,
        axisLabel: {
          formatter: (date: string) => date.slice(5),
          showMinLabel: true,
          showMaxLabel: true,
          hideOverlap: true,
          color: '#9ca3af',
        },
      },
      yAxis: { type: 'value', name: settings.baseCurrency, splitLine: { lineStyle: { color: '#374151' } } },
      series: [
        {
          name: 'Budget remaining',
          type: 'line',
          data: data.remaining,
          step: 'end',
          showSymbol: false,
          lineStyle: { width: 3 },
          itemStyle: { color: '#80cbc4' },
        },
        {
          name: 'Ideal remaining',
          type: 'line',
          data: data.ideal,
          showSymbol: false,
          lineStyle: { type: 'dashed' },
          itemStyle: { color: '#b0bec5' },
        },
      ],
    }),
    [data, settings.baseCurrency]
  );
  return (
    <>
      <p>
        {formatDate(data.dates[1])} – {formatDate(data.dates.at(-1)!)} · Closing day: {settings.closingDay}
      </p>
      {balance !== undefined && (
        <p>
          Budget remaining: {balance.toFixed(2)} {settings.baseCurrency}
        </p>
      )}
      <Chart option={option} />
    </>
  );
}
