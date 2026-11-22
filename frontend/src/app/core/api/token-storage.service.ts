import { Injectable, signal } from '@angular/core';

const TOKEN_KEY = 'dogapp.auth.token';

/**
 * Token-ul JWT al sesiunii, păstrat în `localStorage` ca sesiunea să supraviețuiască unui refresh.
 * `token()` e un signal: `AuthService` reacționează când token-ul dispare (logout, sesiune expirată).
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly current = signal<string | null>(readToken());

  readonly token = this.current.asReadonly();

  set(token: string): void {
    this.current.set(token);
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // localStorage blocat (mod privat): token-ul rămâne doar în memorie
    }
  }

  clear(): void {
    this.current.set(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignorăm
    }
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
