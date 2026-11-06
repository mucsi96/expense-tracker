import { useCallback, useMemo } from 'react';
import type { ECharts, EChartsOption, ECElementEvent } from 'echarts';
import type { Expense } from '../api';
import { toMonthKey, toMonthLabel } from '../domain/month';
import { Chart } from './Chart';
import styles from './Chart.module.css';

const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => escapes[character]);

export default function MonthlySpending({
  expenses,
  closingDay,
  onSelect,
}: {
  expenses: Expense[];
  closingDay: number;
  onSelect: (category: string, month?: string) => void;
}) {
  const spending = useMemo(() => {
    const rows = expenses.filter(
      (expense) => expense.type === 'Expense' && expense.date && expense.category && expense.convertedAmount != null
    );
    const months = [...new Set(rows.map((expense) => toMonthKey(expense.date!, closingDay)))].sort();
    const categories = [...new Set(rows.map((expense) => expense.category!))].sort(
      (a, b) =>
        rows.filter((row) => row.category === b).reduce((sum, row) => sum + row.convertedAmount!, 0) -
          rows.filter((row) => row.category === a).reduce((sum, row) => sum + row.convertedAmount!, 0) ||
        a.localeCompare(b)
    );
    return { rows, months, categories };
  }, [expenses, closingDay]);
  const option = useMemo<EChartsOption>(
    () => ({
      aria: { enabled: true },
      animation: false,
      textStyle: { fontFamily: 'system-ui' },
      legend: {
        top: 0,
        data: spending.categories,
        type: 'scroll',
        textStyle: { color: '#e5e7eb' },
        itemHeight: 14,
        itemGap: 16,
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params) => {
          const { seriesName, value } = params as { seriesName: string; value: number };
          return `<span class="chart-tooltip-name">${escapeHtml(seriesName)}</span><span class="chart-tooltip-value">${value.toFixed(2)}</span>`;
        },
      },
      grid: { top: 50, right: 10, bottom: 10, left: 10, containLabel: true },
      xAxis: {
        type: 'category',
        data: spending.months.map(toMonthLabel),
        axisLabel: { color: '#9ca3af' },
        axisLine: { lineStyle: { color: '#374151' } },
      },
      yAxis: { type: 'value', axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#374151' } } },
      series: [...spending.categories]
        .reverse()
        .map((category) => ({
          name: category,
          type: 'bar',
          stack: 'total',
          cursor: 'pointer',
          data: spending.months.map((month) =>
            spending.rows
              .filter((row) => row.category === category && toMonthKey(row.date!, closingDay) === month)
              .reduce((sum, row) => sum + row.convertedAmount!, 0)
          ),
        })),
    }),
    [spending, closingDay]
  );
  const events = useCallback(
    (chart: ECharts) => {
      chart.on('click', (event: ECElementEvent) => {
        if (event.componentType === 'series' && event.seriesName && Number(event.value) > 0) {
          chart.dispatchAction({ type: 'hideTip' });
          onSelect(event.seriesName, spending.months[event.dataIndex]);
        }
      });
      chart.on('legendselectchanged', (event: unknown) => {
        const { name, selected } = event as { name: string; selected: Record<string, boolean> };
        if (Object.values(selected).every(Boolean)) return;
        chart.dispatchAction({ type: 'legendAllSelect' });
        onSelect(name);
      });
    },
    [onSelect, spending.months]
  );
  return (
    <section aria-label="Monthly spending by category" className={styles.section}>
      <h2>Monthly spending by category</h2>
      {spending.months.length ? <Chart option={option} events={events} /> : <p>No categorized spending yet.</p>}
    </section>
  );
}
