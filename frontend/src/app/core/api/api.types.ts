import { HttpErrorResponse } from '@angular/common/http';
import type { components } from './schema';

/**
 * Tipurile modelelor din API, generate din Swagger (`npm run api:types`).
 *
 *   type Breed = ApiModel<'Breed'>;
 *   type Event = ApiModel<'Event'>;
 *
 * Lista completă e în `components.schemas` din `schema.ts` sau la http://localhost:3000/api/docs.
 */
export type ApiModel<Name extends keyof components['schemas']> = components['schemas'][Name];

/** Meta-ul listelor paginate (`GET /posts`, `GET /search/dogs`). */
export type PaginationMeta = ApiModel<'PaginationMeta'>;

/** O pagină de rezultate: `{ data, meta }` din API. Mesajele au alt meta: `{ hasMore, limit }`. */
export interface Page<T, M = PaginationMeta> {
  items: T[];
  meta: M;
}

/** Un câmp invalid, din `details` la `400 VALIDATION_ERROR`. */
export interface FieldError {
  location?: 'params' | 'query' | 'body';
  path: string;
  message: string;
}

/**
 * Orice eroare venită de la API, în aceeași formă.
 *
 * - `status`: statusul HTTP (0 dacă serverul nu a răspuns deloc).
 * - `code`: codul stabil din API (`NOT_FOUND`, `EMAIL_TAKEN`, `TOKEN_EXPIRED`...), pe care se fac verificările.
 * - `message`: textul din API, în engleză. Pentru utilizator e mai bine un mesaj propriu, ales după `code`.
 * - `fieldErrors`: la `VALIDATION_ERROR`, câmpurile invalide, de afișat lângă input-uri.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get fieldErrors(): FieldError[] {
    if (this.code !== 'VALIDATION_ERROR' || !Array.isArray(this.details)) return [];
    return this.details as FieldError[];
  }

  /** Mesajul pentru un câmp din formular (`'email'`, `'dogId'`...), dacă e invalid. */
  fieldError(path: string): string | undefined {
    return this.fieldErrors.find((e) => e.path === path)?.message;
  }

  static from(err: unknown): ApiError {
    if (err instanceof ApiError) return err;
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return new ApiError(0, 'NETWORK_ERROR', 'The server cannot be reached');
      }
      const body = err.error as {
        error?: { code?: string; message?: string; details?: unknown };
      } | null;
      if (body?.error?.code) {
        return new ApiError(
          err.status,
          body.error.code,
          body.error.message ?? err.message,
          body.error.details,
        );
      }
      return new ApiError(err.status, 'HTTP_ERROR', err.message);
    }
    return new ApiError(0, 'UNKNOWN_ERROR', err instanceof Error ? err.message : String(err));
  }
}
