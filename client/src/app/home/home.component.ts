import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  MatBottomSheet,
  MatBottomSheetModule,
} from '@angular/material/bottom-sheet';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import {
  BarLoaderComponent,
  NotificationsService,
} from '@mucsi96/angular-material-theme';
import { Category, CategoryService } from '../category.service';
import { Expense, ExpenseService } from '../expense.service';
import { MonthlyCategoryChartComponent } from '../monthly-category-chart/monthly-category-chart.component';
import { currentMonthKey, toMonthKey, toMonthLabel } from '../utils/month';
import {
  CategoryPickerResult,
  CategoryPickerSheetComponent,
} from './category-picker-sheet.component';
import { DropConfirmationDialogComponent } from './drop-confirmation-dialog.component';

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
    MatDialogModule,
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
  private readonly dialog = inject(MatDialog);
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

  private readonly filteredExpenses = computed<Expense[]>(() => {
    const month = this.selectedMonth();
    return (this.expenses.value() ?? []).filter(
      (expense) =>
        month === 'all' || (expense.date && toMonthKey(expense.date) === month)
    );
  });

  // Uncategorized transactions are listed separately above the month filter,
  // regardless of the selected month
  readonly uncategorizedDays = computed<ExpenseDay[]>(() =>
    groupByDay(
      (this.expenses.value() ?? []).filter(
        (expense) => !hasCategory(expense)
      )
    )
  );

  readonly days = computed<ExpenseDay[]>(() =>
    groupByDay(this.filteredExpenses().filter(hasCategory))
  );

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

  async openCategoryPicker(expense: Expense): Promise<void> {
    const result = await firstValueFrom(
      this.bottomSheet
        .open<CategoryPickerSheetComponent, void, CategoryPickerResult>(
          CategoryPickerSheetComponent
        )
        .afterDismissed()
    );
    if (!result) {
      return;
    }

    if (result.action === 'drop') {
      await this.dropExpense(expense);
      return;
    }

    if (result.category === expense.category) {
      return;
    }

    try {
      await this.expenseService.setCategory(expense.id, result.category);
    } catch {
      this.notifications.error('Failed to update category');
    }
  }

  private async dropExpense(expense: Expense): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open(DropConfirmationDialogComponent, { data: expense.description })
        .afterClosed()
    );
    if (!confirmed) {
      return;
    }

    try {
      await this.expenseService.dropExpense(expense.id);
      this.notifications.success('Transaction dropped');
    } catch {
      this.notifications.error('Failed to drop transaction');
    }
  }
}
