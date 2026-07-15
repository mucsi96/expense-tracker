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
  method: string;
  comment: string;
}

export interface UploadResponse {
  importedCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class ExpenseService {
  private readonly http = inject(HttpClient);

  expenses = resource<Expense[], {}>({
    loader: () => fetchJson<Expense[]>(this.http, '/api/expenses'),
  });

  async uploadStatement(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await firstValueFrom(
      this.http.post<UploadResponse>('/api/upload', formData)
    );
    this.expenses.reload();
    return response;
  }
}
