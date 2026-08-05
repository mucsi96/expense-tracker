import { Component, computed, inject } from '@angular/core';
import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { Expense, ExpenseService } from '../expense.service';
import { toMonthKey, toMonthLabel } from '../utils/month';

const TEXT_COLOR = 'hsl(220, 13%, 91%)';
const MUTED_COLOR = 'hsl(217, 10%, 64%)';
const GRID_LINE_COLOR = 'hsl(217, 19%, 27%)';

type MonthlySpending = {
  months: string[];
  categories: string[];
  totals: ReadonlyMap<string, number>;
};

function computeMonthlySpending(expenses: Expense[]): MonthlySpending {
  const spendings = expenses.filter(
    (expense) =>
      expense.type === 'Expense' && expense.date && expense.convertedAmount != null
  );
  const months = [
    ...new Set(spendings.map((expense) => toMonthKey(expense.date!))),
  ].sort();
  const totals = spendings.reduce((acc, expense) => {
    const key = `${toMonthKey(expense.date!)}|${expense.category}`;
    return acc.set(key, (acc.get(key) ?? 0) + expense.convertedAmount!);
  }, new Map<string, number>());
  const categories = [
    ...new Set(spendings.map((expense) => expense.category)),
  ].sort();
  return { months, categories, totals };
}

@Component({
  standalone: true,
  imports: [NgxEchartsModule],
  selector: 'app-monthly-category-chart',
  templateUrl: './monthly-category-chart.component.html',
  styleUrl: './monthly-category-chart.component.css',
})
export class MonthlyCategoryChartComponent {
  private readonly expenseService = inject(ExpenseService);

  readonly initOpts = { renderer: 'svg' as const };

  readonly chartOptions = computed<EChartsOption | undefined>(() => {
    const expenses = this.expenseService.expenses.value();
    if (!expenses) {
      return undefined;
    }

    const { months, categories, totals } = computeMonthlySpending(expenses);
    if (months.length === 0) {
      return undefined;
    }

    return {
      aria: {
        enabled: true,
      },
      animation: false,
      textStyle: {
        fontFamily: 'system-ui',
      },
      legend: {
        top: 0,
        // Single scrollable row keeps the legend from eating chart height on
        // narrow screens
        type: 'scroll',
        textStyle: {
          color: TEXT_COLOR,
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      grid: {
        top: 50,
        right: 10,
        bottom: 10,
        left: 10,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: months.map(toMonthLabel),
        axisLabel: {
          color: MUTED_COLOR,
        },
        axisLine: {
          lineStyle: {
            color: GRID_LINE_COLOR,
          },
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: MUTED_COLOR,
        },
        splitLine: {
          lineStyle: {
            color: GRID_LINE_COLOR,
          },
        },
      },
      series: categories.map((category) => ({
        name: category,
        type: 'bar',
        stack: 'total',
        data: months.map(
          (month) => totals.get(`${month}|${category}`) ?? 0
        ),
      })),
    };
  });
}
