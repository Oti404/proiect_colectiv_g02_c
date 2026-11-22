import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from './api.service';
import { TokenStorageService } from './token-storage.service';

/** Codurile cu care API-ul spune că token-ul nu mai e bun. */
const SESSION_ERROR_CODES = new Set(['UNAUTHORIZED', 'INVALID_TOKEN', 'TOKEN_EXPIRED']);

/**
 * Pune `Authorization: Bearer <token>` pe cererile către API.
 * Dacă API-ul răspunde 401 la o cerere care avea token, sesiunea a expirat:
 * ștergem token-ul și trimitem utilizatorul la `/login`.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStorageService);
  const router = inject(Router);

  const token = tokens.token();
  const isApiRequest = req.url.startsWith(API_BASE_URL);
  const authed =
    token && isApiRequest ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      const code = (err as HttpErrorResponse)?.error?.error?.code as string | undefined;
      if (
        token &&
        isApiRequest &&
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        (!code || SESSION_ERROR_CODES.has(code))
      ) {
        tokens.clear();
        void router.navigate(['/login'], { queryParams: { reason: 'session-expired' } });
      }
      return throwError(() => err);
    }),
  );
};
