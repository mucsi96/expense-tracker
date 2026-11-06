import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

export const expenseSchema = z.object({
  id: z.number(),
  date: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  category: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  convertedAmount: z.number().nullable(),
  baseCurrency: z.string().nullable(),
  method: z.string().nullable(),
  type: z.string().nullable(),
  comment: z.string().nullable(),
});
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  emoji: z.string().nullable(),
  description: z.string().nullable(),
});
export const settingsSchema = z.object({
  closingDay: z.number().int().min(1).max(31),
  monthlyBudget: z.number(),
  baseCurrency: z.string(),
});
export const userInfoSchema = z.object({
  email: z.string(),
  preferredUsername: z.string().optional(),
  additionalClaims: z.object({ name: z.string().optional() }).optional(),
});
export type Expense = z.infer<typeof expenseSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type CategoryAttributes = Pick<Category, 'name' | 'emoji' | 'description'>;

// Gateway sessions own OAuth. The browser sends only a same-origin CSRF proof.
export async function fetchJson<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) throw new Error('API requests must be same-origin');
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes((init.method ?? 'GET').toUpperCase())) {
    const cookie = document.cookie
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith('__Host-XSRF-TOKEN='));
    if (!cookie) throw new Error('Missing CSRF token');
    headers.set('X-XSRF-TOKEN', decodeURIComponent(cookie.slice('__Host-XSRF-TOKEN='.length)));
  }
  const response = await fetch(url, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  // Spring's void DELETE handlers return 200 with an empty body, while the
  // notification endpoint uses 204. Validate both through the caller's schema.
  const body = await response.text();
  return schema.parse(body === '' ? undefined : JSON.parse(body));
}

export const expensesQuery = queryOptions({
  queryKey: ['expenses'],
  queryFn: ({ signal }) => fetchJson('/api/expenses', expenseSchema.array(), { signal }),
});
export const categoriesQuery = queryOptions({
  queryKey: ['categories'],
  queryFn: ({ signal }) => fetchJson('/api/categories', categorySchema.array(), { signal }),
});
export const settingsQuery = queryOptions({
  queryKey: ['settings'],
  queryFn: ({ signal }) => fetchJson('/api/settings', settingsSchema, { signal }),
});
export const deleteResource = (path: string) => fetchJson(path, z.undefined(), { method: 'DELETE' });
