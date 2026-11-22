import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from '../api/auth.interceptor';
import { TokenStorageService } from '../api/token-storage.service';
import { DemoAuthService } from '../services/demo-auth.service';
import { authGuard, guestGuard } from './auth.guards';
import { AuthService, AuthUser } from './auth.service';
import { coordinatesOf, nearestNeighborhood } from './neighborhoods';

function apiUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    email: 'ana.pop@demo.dogapp',
    emailVerified: true,
    firstName: 'Ana',
    lastName: 'Pop',
    avatarUrl: null,
    bio: null,
    approxLatitude: 46.77,
    approxLongitude: 23.59,
    consentAt: '2026-10-05T09:00:00.000Z',
    createdAt: '2026-10-05T09:00:00.000Z',
    updatedAt: '2026-10-05T09:00:00.000Z',
    ...overrides,
  };
}

describe('Auth', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let tokens: TokenStorageService;
  let demo: DemoAuthService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    tokens = TestBed.inject(TokenStorageService);
    demo = TestBed.inject(DemoAuthService);
  });

  afterEach(() => {
    http.verify();
    window.localStorage.clear();
  });

  it('logs in, stores the token and mirrors the user into the demo data', async () => {
    const result = firstValueFrom(auth.login('ana.pop@demo.dogapp', 'pass1'));
    const req = http.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ email: 'ana.pop@demo.dogapp', password: 'pass1' });
    req.flush({ data: { token: 'tok', user: apiUser() } });

    expect((await result).email).toBe('ana.pop@demo.dogapp');
    expect(auth.isAuthenticated()).toBe(true);
    expect(tokens.token()).toBe('tok');
    // Contul demo din mock-uri, găsit după email
    expect(demo.currentUser()?.id).toBe('user-ana');
  });

  it('keeps the user logged out when the login fails', async () => {
    const result = firstValueFrom(auth.login('ana.pop@demo.dogapp', 'wrong'));
    http
      .expectOne('/api/auth/login')
      .flush(
        { error: { code: 'INVALID_CREDENTIALS', message: 'no' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(await result.catch((e: unknown) => e)).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(auth.isAuthenticated()).toBe(false);
    expect(tokens.token()).toBeNull();
  });

  it('registers a new account and adds it to the demo data', async () => {
    const created = apiUser({
      id: 'new-id',
      email: 'new@test.local',
      firstName: 'Nou',
      approxLatitude: 46.78,
      approxLongitude: 23.61,
    });
    const result = firstValueFrom(
      auth.register({
        email: 'new@test.local',
        password: 'o-parola-buna',
        firstName: 'Nou',
        lastName: 'Cont',
        ...coordinatesOf('Mărăști'),
        consentAccepted: true,
      }),
    );
    const req = http.expectOne('/api/auth/register');
    expect(req.request.body).toMatchObject({
      latitude: 46.78,
      longitude: 23.61,
      consentAccepted: true,
    });
    req.flush({ data: { token: 'tok2', user: created } }, { status: 201, statusText: 'Created' });
    await result;

    expect(auth.user()?.email).toBe('new@test.local');
    expect(demo.currentUser()).toMatchObject({
      id: 'new-id',
      email: 'new@test.local',
      neighborhood: 'Mărăști',
    });
  });

  it('restores the session from a saved token', async () => {
    tokens.set('saved');
    const restoring = auth.restoreSession();
    const req = http.expectOne('/api/auth/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer saved');
    req.flush({ data: apiUser() });
    await restoring;

    expect(auth.status()).toBe('authenticated');
  });

  it('drops an invalid saved token on startup', async () => {
    tokens.set('bad');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const restoring = auth.restoreSession();
    http
      .expectOne('/api/auth/me')
      .flush(
        { error: { code: 'INVALID_TOKEN', message: 'bad' } },
        { status: 401, statusText: 'Unauthorized' },
      );
    await restoring;

    expect(auth.status()).toBe('anonymous');
    expect(tokens.token()).toBeNull();
  });

  it('keeps the saved token when the server is down at startup', async () => {
    tokens.set('saved');
    const restoring = auth.restoreSession();
    http.expectOne('/api/auth/me').error(new ProgressEvent('error'), { status: 0 });
    await restoring;

    expect(auth.status()).toBe('anonymous');
    expect(tokens.token()).toBe('saved');
  });

  it('is anonymous right away when there is no token', async () => {
    await auth.restoreSession();
    expect(auth.status()).toBe('anonymous');
  });

  it('logs out everywhere when the token is cleared by the interceptor', async () => {
    const login = firstValueFrom(auth.login('ana.pop@demo.dogapp', 'pass1'));
    http.expectOne('/api/auth/login').flush({ data: { token: 'tok', user: apiUser() } });
    await login;

    tokens.clear();
    TestBed.tick();

    expect(auth.isAuthenticated()).toBe(false);
    expect(demo.currentUser()).toBeNull();
  });

  it('logout clears the token and the demo session', async () => {
    const login = firstValueFrom(auth.login('ana.pop@demo.dogapp', 'pass1'));
    http.expectOne('/api/auth/login').flush({ data: { token: 'tok', user: apiUser() } });
    await login;

    auth.logout();
    expect(tokens.token()).toBeNull();
    expect(auth.user()).toBeNull();
    expect(demo.currentUser()).toBeNull();
  });

  describe('guards', () => {
    const runGuard = (guard: typeof authGuard, url = '/events') =>
      TestBed.runInInjectionContext(() =>
        guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
      );

    it('authGuard sends anonymous users to /login with the requested page', async () => {
      await auth.restoreSession();
      const result = runGuard(authGuard) as UrlTree;
      expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fevents');
    });

    it('authGuard lets logged-in users through, guestGuard sends them to /search', async () => {
      const login = firstValueFrom(auth.login('ana.pop@demo.dogapp', 'pass1'));
      http.expectOne('/api/auth/login').flush({ data: { token: 'tok', user: apiUser() } });
      await login;

      expect(runGuard(authGuard)).toBe(true);
      expect(TestBed.inject(Router).serializeUrl(runGuard(guestGuard) as UrlTree)).toBe('/search');
    });
  });
});

describe('neighborhoods', () => {
  it('maps API coordinates back to the nearest neighborhood', () => {
    expect(nearestNeighborhood(46.77, 23.62)).toBe('Gheorgheni');
    expect(nearestNeighborhood(46.751, 23.601)).toBe('Bună Ziua');
    expect(coordinatesOf('Zorilor')).toEqual({ latitude: 46.75, longitude: 23.58 });
    expect(coordinatesOf('Nicăieri')).toEqual({ latitude: 46.77, longitude: 23.59 });
  });
});
