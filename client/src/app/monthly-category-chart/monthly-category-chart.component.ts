import { Component, computed, inject, output } from '@angular/core';
import type { ECElementEvent, ECharts, EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { Expense, ExpenseService } from '../expense.service';
import { SettingsService } from '../settings.service';
import { toMonthKey, toMonthLabel } from '../utils/month';

const TEXT_COLOR = 'hsl(220, 13%, 91%)';
const MUTED_COLOR = 'hsl(217, 10%, 64%)';
const GRID_LINE_COLOR = 'hsl(217, 19%, 27%)';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);

export type CategoryFilter = {
  // The month the category was picked in; null when the pick carries no month
  // (the legend spans every month) and the current selection is kept
  month: string | null;
  category: string;
};

type MonthlySpending = {
  months: string[];
  // Ordered by overall spending, largest category first
  categories: string[];
  totals: ReadonlyMap<string, number>;
};

type LegendSelectChanged = {
  name: string;
  selected: Record<string, boolean>;
};

type TooltipItem = {
  seriesName: string;
  value: number;
};

function computeMonthlySpending(
  expenses: Expense[],
  closingDay: number
): MonthlySpending {
  // Uncategorized spending is left out: every category in the chart is a
  // category the list can be filtered by, and it has no name to show
  const spendings = expenses.filter(
    (expense) =>
      expense.type === 'Expense' &&
      expense.date &&
      expense.category &&
      expense.convertedAmount != null
  );
  const months = [
    ...new Set(
      spendings.map((expense) => toMonthKey(expense.date!, closingDay))
    ),
  ].sort();
  const totals = spendings.reduce((acc, expense) => {
    const key = `${toMonthKey(expense.date!, closingDay)}|${expense.category}`;
    return acc.set(key, (acc.get(key) ?? 0) + expense.convertedAmount!);
  }, new Map<string, number>());
  const categoryTotals = spendings.reduce(
    (acc, expense) =>
      acc.set(
        expense.category,
        (acc.get(expense.category) ?? 0) + expense.convertedAmount!
      ),
    new Map<string, number>()
  );
  const categories = [...categoryTotals.keys()].sort(
    (a, b) =>
      categoryTotals.get(b)! - categoryTotals.get(a)! || a.localeCompare(b)
  );
  return { months, categories, totals };
}

const renderTooltip = ({ seriesName, value }: TooltipItem): string =>
  `<span class="chart-tooltip-name">${escapeHtml(seriesName)}</span>` +
  `<span class="chart-tooltip-value">${value.toFixed(2)}</span>`;

@Component({
  standalone: true,
  imports: [NgxEchartsModule],
  selector: 'app-monthly-category-chart',
  templateUrl: './monthly-category-chart.component.html',
  styleUrl: './monthly-category-chart.component.css',
})
export class MonthlyCategoryChartComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly settingsService = inject(SettingsService);
  private chart?: ECharts;

  readonly categorySelected = output<CategoryFilter>();

  readonly initOpts = { renderer: 'svg' as const };

  private readonly spending = computed<MonthlySpending | undefined>(() => {
    const expenses = this.expenseService.expenses.value();
    const closingDay = this.settingsService.closingDay();
    if (!expenses || closingDay === undefined) {
      return undefined;
    }
    const spending = computeMonthlySpending(expenses, closingDay);
    return spending.months.length ? spending : undefined;
  });

  readonly chartOptions = computed<EChartsOption | undefined>(() => {
    const spending = this.spending();
    if (!spending) {
      return undefined;
    }

    const { months, categories, totals } = spending;

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
        // Series are stacked smallest first, so the legend lists the
        // categories explicitly to lead with the largest one
        data: categories,
        // Single scrollable row keeps the legend from eating chart height on
        // narrow screens
        type: 'scroll',
        textStyle: {
          color: TEXT_COLOR,
        },
        // Roomy enough to hit with a thumb
        itemHeight: 14,
        itemGap: 16,
      },
      // Minimal, non-interactive tooltip: only the hovered segment's category
      // and its total; filtering happens by clicking the segment itself
      tooltip: {
        trigger: 'item',
        // Kept inside the chart so it never leaves the viewport on phones
        confine: true,
        formatter: (params) => renderTooltip(params as unknown as TooltipItem),
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
      // Bars stack bottom-up in series order, so the order is reversed to put
      // the category with the largest spending on top of the stack
      series: [...categories].reverse().map((category) => ({
        name: category,
        type: 'bar',
        stack: 'total',
        cursor: 'pointer',
        data: months.map(
          (month) => totals.get(`${month}|${category}`) ?? 0
        ),
      })),
    };
  });

  onChartInit(chart: ECharts): void {
    this.chart = chart;
  }

  // Tapping a stacked bar segment filters by its month and category. Clicks on
  // anything else in the chart (axis, empty grid) carry no category.
  onChartClick({
    componentType,
    seriesName,
    dataIndex,
    value,
  }: ECElementEvent): void {
    if (componentType !== 'series' || !seriesName || (value as number) <= 0) {
      return;
    }
    this.selectCategory(this.spending()!.months[dataIndex], seriesName);
  }

  // The legend is a category picker rather than a visibility toggle: the
  // series ECharts just hid is restored and the list is filtered instead
  onLegendSelectChanged({ name, selected }: LegendSelectChanged): void {
    if (Object.values(selected).every(Boolean)) {
      // Our own restore below, echoed back as an event
      return;
    }
    this.chart?.dispatchAction({ type: 'legendAllSelect' });
    this.selectCategory(null, name);
  }

  private selectCategory(month: string | null, category: string): void {
    this.chart?.dispatchAction({ type: 'hideTip' });
    this.categorySelected.emit({ month, category });
  }
}
