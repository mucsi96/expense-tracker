import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { Expense, ExpenseService } from '../expense.service';
import { MonthlyCategoryChartComponent } from '../monthly-category-chart/monthly-category-chart.component';
import { currentMonthKey, toMonthKey, toMonthLabel } from '../utils/month';

type ExpenseDay = {
  day: string;
  label: string;
  expenses: Expense[];
};

type MonthOption = {
  key: string;
  label: string;
};

const toDayKey = (expense: Expense): string => expense.date?.slice(0, 10) ?? '';

const toDayLabel = (day: string): string => {
  if (!day) {
    return 'Unknown date';
  }
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, dayOfMonth)).toLocaleDateString(
    'en-US',
    {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }
  );
};

const groupByDay = (expenses: Expense[]): ExpenseDay[] =>
  [...new Set(expenses.map(toDayKey))]
    // Newest day first; expenses without a date ('') sort last
    .sort((a, b) => b.localeCompare(a))
    .map((day) => ({
      day,
      label: toDayLabel(day),
      expenses: expenses.filter((expense) => toDayKey(expense) === day),
    }));

const isForeign = (expense: Expense): boolean =>
  expense.currency !== expense.baseCurrency && expense.convertedAmount != null;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    BarLoaderComponent,
    MatButtonToggleModule,
    MonthlyCategoryChartComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly expenseService = inject(ExpenseService);
  readonly expenses = this.expenseService.expenses;

  // 'all' or a 'yyyy-MM' month key; only the current month is listed by default
  readonly selectedMonth = signal<string>(currentMonthKey());

  readonly monthOptions = computed<MonthOption[]>(() => {
    const monthKeys = (this.expenses.value() ?? []).flatMap((expense) =>
      expense.date ? [toMonthKey(expense.date)] : []
    );
    return [...new Set([currentMonthKey(), ...monthKeys])]
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({ key, label: toMonthLabel(key) }));
  });

  readonly days = computed<ExpenseDay[]>(() => {
    const month = this.selectedMonth();
    const expenses = (this.expenses.value() ?? []).filter(
      (expense) =>
        month === 'all' || (expense.date && toMonthKey(expense.date) === month)
    );
    return groupByDay(expenses);
  });

  readonly selectedMonthLabel = computed(() => {
    const month = this.selectedMonth();
    return month === 'all' ? 'any month' : toMonthLabel(month);
  });

  isIncome(expense: Expense): boolean {
    return expense.type === 'Income';
  }

  signedAmount(expense: Expense): string {
    const [value, currency] = isForeign(expense)
      ? [expense.convertedAmount, expense.baseCurrency]
      : [expense.amount, expense.currency];
    if (value == null) {
      return '';
    }
    const sign = this.isIncome(expense) ? '+' : '-';
    return `${sign}${value.toFixed(2)} ${currency}`;
  }

  originalAmount(expense: Expense): string {
    return isForeign(expense) && expense.amount != null
      ? `${expense.amount.toFixed(2)} ${expense.currency}`
      : '';
  }
}
