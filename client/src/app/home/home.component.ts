import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  BarLoaderComponent,
  NotificationsService,
} from '@mucsi96/angular-material-theme';
import { Expense, ExpenseService } from '../expense.service';
import { MonthlyCategoryChartComponent } from '../monthly-category-chart/monthly-category-chart.component';

type ExpenseDay = {
  day: string;
  label: string;
  expenses: Expense[];
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
  imports: [BarLoaderComponent, MatButtonModule, MonthlyCategoryChartComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly notifications = inject(NotificationsService);
  readonly expenses = this.expenseService.expenses;
  readonly uploading = signal(false);
  readonly dragOver = signal(false);

  readonly days = computed<ExpenseDay[]>(() =>
    groupByDay(this.expenses.value() ?? [])
  );

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

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    void this.importFiles(files);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    // dragleave also fires when moving onto a child of the dropzone
    const dropzone = event.currentTarget as HTMLElement;
    if (event.relatedTarget && dropzone.contains(event.relatedTarget as Node)) {
      return;
    }
    this.dragOver.set(false);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragOver.set(false);
    await this.importFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  private async importFiles(files: File[]): Promise<void> {
    if (!files.length) {
      return;
    }

    const csvFiles = files.filter((file) =>
      file.name.toLowerCase().endsWith('.csv')
    );
    if (!csvFiles.length) {
      this.notifications.error('Only CSV statements are supported');
      return;
    }

    this.uploading.set(true);
    try {
      // Sequential so server-side duplicate detection sees earlier imports
      for (const file of csvFiles) {
        await this.uploadFile(file);
      }
    } finally {
      this.uploading.set(false);
    }
  }

  private async uploadFile(file: File): Promise<void> {
    try {
      const response = await this.expenseService.uploadStatement(file);
      this.notifications.success(
        `${response.importedCount} expense(s) imported from ${file.name}`
      );
    } catch {
      this.notifications.error(`Failed to import ${file.name}`);
    }
  }
}
