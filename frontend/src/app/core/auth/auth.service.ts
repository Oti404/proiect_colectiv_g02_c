import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, map, tap } from 'rxjs';
import { ApiService } from '../api/api.service';
import { ApiError, ApiModel } from '../api/api.types';
import { TokenStorageService } from '../api/token-storage.service';
import { DemoAuthService } from '../services/demo-auth.service';

export type AuthUser = ApiModel<'SelfUser'>;
type AuthResult = ApiModel<'AuthResult'>;

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  bio?: string | null;
  latitude: number;
  longitude: number;
  consentAccepted: true;
}

/** `unknown`: încă verificăm token-ul salvat (la pornirea aplicației). */
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

/** Parola tuturor conturilor demo din seed-ul backend-ului. */
export const DEMO_PASSWORD = 'pass1';

/**
 * Sesiunea reală, prin `/api/auth`.
 *
 * Temporar, până se mută toate modulele pe API (INTEGRATION_TASKS.md, secțiunea 9),
 * utilizatorul logat e oglindit și în datele demo (`DemoAuthService.adoptApiUser`),
 * ca paginile care încă folosesc mock-urile să aibă un utilizator curent.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStorageService);
  private readonly demoBridge = inject(DemoAuthService);

  private readonly currentUser = signal<AuthUser | null>(null);
  private readonly currentStatus = signal<AuthStatus>('unknown');

  readonly user = this.currentUser.asReadonly();
  readonly status = this.currentStatus.asReadonly();
  readonly isAuthenticated = computed(() => this.currentStatus() === 'authenticated');

  constructor() {
    // Token-ul poate dispărea și din afară: interceptorul îl șterge când sesiunea expiră.
    effect(() => {
      if (this.tokens.token() === null && this.currentStatus() === 'authenticated') {
        this.endSession();
      }
    });
  }

  /**
   * Reface sesiunea din token-ul salvat. Rulează o dată, la pornirea aplicației.
   * Nu aruncă niciodată: la orice eroare, utilizatorul rămâne nelogat.
   */
  async restoreSession(): Promise<void> {
    if (!this.tokens.token()) {
      this.endSession();
      return;
    }
    try {
      this.startSession(await firstValueFrom(this.api.get<AuthUser>('/auth/me')));
    } catch (err) {
      // 401 → token invalid (interceptorul l-a șters deja). Server oprit → păstrăm token-ul pentru data viitoare.
      if (ApiError.from(err).status !== 0) this.tokens.clear();
      this.endSession();
    }
  }

  login(email: string, password: string): Observable<AuthUser> {
    return this.api.post<AuthResult>('/auth/login', { email, password }).pipe(
      tap((res) => this.tokens.set(res.token)),
      map((res) => res.user),
      tap((user) => this.startSession(user)),
    );
  }

  register(payload: RegisterPayload): Observable<AuthUser> {
    return this.api.post<AuthResult>('/auth/register', payload).pipe(
      tap((res) => this.tokens.set(res.token)),
      map((res) => res.user),
      tap((user) => this.startSession(user)),
    );
  }

  logout(): void {
    this.tokens.clear();
    this.endSession();
  }

  private startSession(user: AuthUser): void {
    this.currentUser.set(user);
    this.currentStatus.set('authenticated');
    this.demoBridge.adoptApiUser(user);
  }

  private endSession(): void {
    this.currentUser.set(null);
    this.currentStatus.set('anonymous');
    this.demoBridge.logout();
  }
}
