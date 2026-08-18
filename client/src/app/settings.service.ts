import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { fetchJson } from './utils/fetchJson';

export interface Settings {
  // Last day of the monthly period: transactions after it count towards the
  // next month. 31 covers every month end, i.e. plain calendar months.
  closingDay: number;
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly http = inject(HttpClient);

  readonly settings = resource<Settings, {}>({
    loader: () => fetchJson<Settings>(this.http, '/api/settings'),
  });

  readonly closingDay = computed<number | undefined>(
    () => this.settings.value()?.closingDay
  );

  async updateClosingDay(closingDay: number): Promise<void> {
    await firstValueFrom(
      this.http.put<Settings>('/api/settings', { closingDay })
    );
    this.settings.reload();
  }
}
