import { HttpClient } from '@angular/common/http';
import { Injectable, inject, resource } from '@angular/core';
import { fetchJson } from './utils/fetchJson';

export interface InsightResponse {
  insight: string;
}

@Injectable({
  providedIn: 'root',
})
export class InsightService {
  private readonly http = inject(HttpClient);

  insight = resource<InsightResponse, {}>({
    loader: () => fetchJson<InsightResponse>(this.http, '/api/insight'),
  });
}
