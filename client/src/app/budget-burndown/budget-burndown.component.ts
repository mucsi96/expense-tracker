import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { ExpenseService } from '../expense.service';
import { SettingsService } from '../settings.service';
import { toMonthLabel } from '../utils/month';
import { budgetBurndown } from './budget-burndown';

@Component({
  selector: 'app-budget-burndown',
  imports: [NgxEchartsModule, RouterLink],
  templateUrl: './budget-burndown.component.html',
  styleUrl: './budget-burndown.component.css',
})
export class BudgetBurndownComponent {
  readonly month = input.required<string>();
  private readonly expenses = inject(ExpenseService).expenses;
  readonly settings = inject(SettingsService).settings;
  readonly initOpts = { renderer: 'svg' as const };
  readonly monthLabel = computed(() => this.month() === 'all' ? '' : toMonthLabel(this.month()));
  private readonly data = computed(() => {
    const settings = this.settings.value();
    const expenses = this.expenses.value();
    if (!settings || !expenses || !settings.monthlyBudget || this.month() === 'all') {
      return undefined;
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return budgetBurndown(expenses, this.month(), settings.closingDay, settings.monthlyBudget, today);
  });
  readonly balance = computed(() => {
    const remaining = this.data()?.remaining.filter((value) => value !== null);
    return remaining?.length ? `${remaining.at(-1)!.toFixed(2)} ${this.settings.value()!.baseCurrency}` : undefined;
  });
  readonly chartOptions = computed<EChartsOption | undefined>(() => {
    const data = this.data();
    if (!data) {
      return undefined;
    }
    return {
      aria: { enabled: true },
      animation: false,
      textStyle: { fontFamily: 'system-ui', color: 'hsl(220, 13%, 91%)' },
      legend: { textStyle: { color: 'hsl(220, 13%, 91%)' } },
      tooltip: { trigger: 'axis', confine: true, valueFormatter: (value) => `${Number(value).toFixed(2)} ${this.settings.value()!.baseCurrency}` },
      grid: { top: 60, right: 16, bottom: 16, left: 12, containLabel: true },
      xAxis: { type: 'category', data: data.dates, axisLabel: { formatter: (date: string) => date.slice(5) } },
      yAxis: { type: 'value', name: this.settings.value()!.baseCurrency, splitLine: { lineStyle: { color: 'hsl(217, 19%, 27%)' } } },
      series: [
        { name: 'Budget remaining', type: 'line', data: data.remaining, step: 'end', showSymbol: false, lineStyle: { width: 3 }, itemStyle: { color: '#80cbc4' } },
        { name: 'Ideal remaining', type: 'line', data: data.ideal, showSymbol: false, lineStyle: { type: 'dashed' }, itemStyle: { color: '#b0bec5' } },
      ],
    };
  });
}
