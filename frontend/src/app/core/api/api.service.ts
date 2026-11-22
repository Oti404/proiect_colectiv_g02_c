import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiError, Page, PaginationMeta } from './api.types';

/** Toate rutele API sunt sub `/api` (proxy în `ng serve`, nginx în Docker). */
export const API_BASE_URL = '/api';

/** Query params: valorile `undefined`, `null` și `''` nu se trimit. */
export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/**
 * Singurul loc din aplicație care vorbește cu backend-ul.
 *
 * - Despachetează răspunsurile: `{ data }` → `data`, `{ data, meta }` → `{ items, meta }`.
 * - Orice eroare devine `ApiError` (vezi `api.types.ts`).
 * - Token-ul îl pune `authInterceptor`, nu trebuie trimis de mână.
 *
 *   this.api.get<Breed[]>('/breeds')
 *   this.api.getPage<Post>('/posts', { page: 2 })
 *   this.api.post<Dog>('/dogs', draft)
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.unwrap(
      this.http.get<{ data: T }>(this.url(path), { params: toHttpParams(params) }),
    );
  }

  /** Pentru rutele paginate (`GET /posts`, `GET /search/dogs`). */
  getPage<T>(path: string, params?: QueryParams): Observable<Page<T>> {
    return this.http
      .get<{ data: T[]; meta: PaginationMeta }>(this.url(path), { params: toHttpParams(params) })
      .pipe(
        map((res) => ({ items: res.data, meta: res.meta })),
        catchError((err) => throwError(() => ApiError.from(err))),
      );
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.unwrap(this.http.post<{ data: T }>(this.url(path), body));
  }

  put<T>(path: string, body: unknown = {}): Observable<T> {
    return this.unwrap(this.http.put<{ data: T }>(this.url(path), body));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.unwrap(this.http.patch<{ data: T }>(this.url(path), body));
  }

  /** `DELETE`. Rutele care răspund `204` dau `undefined`. Unele (`DELETE /users/me`) cer și un body. */
  delete<T = void>(path: string, body?: unknown): Observable<T> {
    return this.unwrap(this.http.delete<{ data: T } | null>(this.url(path), { body }));
  }

  private url(path: string): string {
    return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private unwrap<T>(request: Observable<{ data: T } | null>): Observable<T> {
    return request.pipe(
      map((res) => (res === null ? (undefined as T) : res.data)),
      catchError((err) => throwError(() => ApiError.from(err))),
    );
  }
}

function toHttpParams(params?: QueryParams): HttpParams | undefined {
  if (!params) return undefined;
  let httpParams = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    httpParams = httpParams.set(key, String(value));
  }
  return httpParams;
}
