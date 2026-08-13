import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  MatBottomSheet,
  MatBottomSheetModule,
} from '@angular/material/bottom-sheet';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  BarLoaderComponent,
  NotificationsService,
} from '@mucsi96/angular-material-theme';
import { Category, CategoryService } from '../category.service';
import { Expense, ExpenseService } from '../expense.service';
import {
  CategoryFilter,
  MonthlyCategoryChartComponent,
} from '../monthly-category-chart/monthly-category-chart.component';
import { currentMonthKey, toMonthKey, toMonthLabel } from '../utils/month';
import { CategoryPickerSheetComponent } from './category-picker-sheet.component';

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

const hasCategory = (expense: Expense): boolean => !!expense.category;

const isForeign = (expense: Expense): boolean =>
  expense.currency !== expense.baseCurrency && expense.convertedAmount != null;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    BarLoaderComponent,
    MatBottomSheetModule,
    MatButtonToggleModule,
    MatTooltipModule,
    MonthlyCategoryChartComponent,
    NgTemplateOutlet,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly categoryService = inject(CategoryService);
  private readonly notifications = inject(NotificationsService);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly expenses = this.expenseService.expenses;

  private readonly categoriesByName = computed<Map<string, Category>>(
    () =>
      new Map(
        (this.categoryService.categories.value() ?? []).map((category) => [
          category.name,
          category,
        ])
      )
  );

  // The URL is the single source of truth for both filters, so a filtered view
  // survives a reload and can be shared
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  // 'all' or a 'yyyy-MM' month key; only the current month is listed by default
  readonly selectedMonth = computed<string>(
    () => this.queryParams().get('month') ?? currentMonthKey()
  );

  readonly selectedCategory = computed<string | null>(() =>
    this.queryParams().get('category')
  );

  readonly monthOptions = computed<MonthOption[]>(() => {
    const monthKeys = (this.expenses.value() ?? []).flatMap((expense) =>
      expense.date ? [toMonthKey(expense.date)] : []
    );
    return [...new Set([currentMonthKey(), ...monthKeys])]
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({ key, label: toMonthLabel(key) }));
  });

  private readonly filteredExpenses = computed<Expense[]>(() => {
    const month = this.selectedMonth();
    const category = this.selectedCategory();
    return (this.expenses.value() ?? []).filter(
      (expense) =>
        (month === 'all' ||
          (expense.date && toMonthKey(expense.date) === month)) &&
        (category === null || expense.category === category)
    );
  });

  // Uncategorized transactions are listed separately above the month filter,
  // regardless of the selected month. Filtering by a category hides them, as
  // they are by definition not part of that category.
  readonly uncategorizedDays = computed<ExpenseDay[]>(() =>
    this.selectedCategory() !== null
      ? []
      : groupByDay(
          (this.expenses.value() ?? []).filter(
            (expense) => !hasCategory(expense)
          )
        )
  );

  readonly days = computed<ExpenseDay[]>(() =>
    groupByDay(this.filteredExpenses().filter(hasCategory))
  );

  readonly matchCountLabel = computed<string>(() => {
    const count = this.filteredExpenses().length;
    return `${count} ${count === 1 ? 'transaction' : 'transactions'}`;
  });

  readonly totalSpend = computed<string>(() => {
    const baseCurrency = this.expenses.value()?.[0]?.baseCurrency;
    if (!baseCurrency) {
      return '';
    }
    const total = this.filteredExpenses()
      .filter((expense) => expense.type === 'Expense')
      .flatMap((expense) => {
        const value = isForeign(expense)
          ? expense.convertedAmount
          : expense.amount;
        return value == null ? [] : [value];
      })
      .reduce((sum, value) => sum + value, 0);
    return `${total.toFixed(2)} ${baseCurrency}`;
  });

  readonly selectedMonthLabel = computed(() => {
    const month = this.selectedMonth();
    return month === 'all' ? 'any month' : toMonthLabel(month);
  });

  readonly selectedCategoryEmoji = computed<string>(
    () => this.categoriesByName().get(this.selectedCategory()!)?.emoji ?? ''
  );

  selectMonth(month: string): void {
    // Months are browsed back and forth, so they replace the URL instead of
    // stacking up history entries
    this.applyFilters(month, this.selectedCategory(), true);
  }

  // A category filter is a drill-down: it gets its own history entry so the
  // back gesture returns to the full list
  applyCategoryFilter({ month, category }: CategoryFilter): void {
    // A pick without a month (the legend) keeps the month in view
    this.applyFilters(month ?? this.selectedMonth(), category, false);
  }

  clearCategoryFilter(): void {
    this.applyFilters(this.selectedMonth(), null, false);
  }

  private applyFilters(
    month: string,
    category: string | null,
    replaceUrl: boolean
  ): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { month, category },
      replaceUrl,
    });
  }

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

  categoryLabel(expense: Expense): string {
    return expense.category || 'Uncategorized';
  }

  categoryEmoji(expense: Expense): string {
    return this.categoriesByName().get(expense.category)?.emoji ?? '';
  }

  categoryDescription(expense: Expense): string {
    return this.categoriesByName().get(expense.category)?.description ?? '';
  }

  async changeCategory(expense: Expense): Promise<void> {
    const category = await firstValueFrom(
      this.bottomSheet.open(CategoryPickerSheetComponent).afterDismissed()
    );
    if (!category || category === expense.category) {
      return;
    }

    try {
      await this.expenseService.setCategory(expense.id, category);
    } catch {
      this.notifications.error('Failed to update category');
    }
  }
}
