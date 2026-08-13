import { HttpClient } from '@angular/common/http';
import { Injectable, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { fetchJson } from './utils/fetchJson';

export interface Expense {
  id: number;
  date: string | null;
  description: string;
  location: string;
  category: string;
  amount: number | null;
  currency: string;
  convertedAmount: number | null;
  baseCurrency: string;
  method: string;
  type: string;
  comment: string;
}

@Injectable({
  providedIn: 'root',
})
export class ExpenseService {
  private readonly http = inject(HttpClient);

  expenses = resource<Expense[], {}>({
    loader: () => fetchJson<Expense[]>(this.http, '/api/expenses'),
  });

  async deleteAllExpenses(): Promise<void> {
    await firstValueFrom(this.http.delete<void>('/api/expenses'));
    this.expenses.reload();
  }

  async dropExpense(expenseId: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`/api/expenses/${expenseId}`));
    this.expenses.reload();
  }

  async setCategory(expenseId: number, category: string): Promise<void> {
    await firstValueFrom(
      this.http.put<Expense>(`/api/expenses/${expenseId}/category`, {
        category,
      })
    );
    this.expenses.reload();
  }
}
