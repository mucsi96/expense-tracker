import { HttpClient } from '@angular/common/http';
import { Injectable, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { fetchJson } from './utils/fetchJson';

export interface Category {
  id: number;
  name: string;
  emoji: string | null;
  description: string | null;
}

export interface CategoryAttributes {
  name: string;
  emoji: string;
  description: string;
}

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly http = inject(HttpClient);

  categories = resource<Category[], {}>({
    loader: () => fetchJson<Category[]>(this.http, '/api/categories'),
  });

  async addCategory(attributes: CategoryAttributes): Promise<void> {
    await firstValueFrom(
      this.http.post<Category>('/api/categories', attributes)
    );
    this.categories.reload();
  }

  async updateCategory(
    id: number,
    attributes: CategoryAttributes
  ): Promise<void> {
    await firstValueFrom(
      this.http.put<Category>(`/api/categories/${id}`, attributes)
    );
    this.categories.reload();
  }

  async deleteCategory(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`/api/categories/${id}`));
    this.categories.reload();
  }
}
