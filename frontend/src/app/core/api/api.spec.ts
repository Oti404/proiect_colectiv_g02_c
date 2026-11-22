import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ApiError } from './api.types';
import { authInterceptor } from './auth.interceptor';
import { BreedApiService } from './breed-api.service';
import { TokenStorageService } from './token-storage.service';

describe('API foundation', () => {
  let http: HttpTestingController;
  let api: ApiService;
  let tokens: TokenStorageService;

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
    api = TestBed.inject(ApiService);
    tokens = TestBed.inject(TokenStorageService);
  });

  afterEach(() => {
    http.verify();
    window.localStorage.clear();
  });

  describe('ApiService', () => {
    it('prefixes /api and unwraps { data }', async () => {
      const result = firstValueFrom(api.get<{ id: string }>('/dogs/1'));
      http.expectOne('/api/dogs/1').flush({ data: { id: '1' } });
      expect(await result).toEqual({ id: '1' });
    });

    it('unwraps paginated responses into { items, meta }', async () => {
      const meta = { page: 2, pageSize: 20, total: 21, totalPages: 2 };
      const result = firstValueFrom(api.getPage('/posts', { page: 2 }));
      http.expectOne('/api/posts?page=2').flush({ data: [{ id: 'p' }], meta });
      expect(await result).toEqual({ items: [{ id: 'p' }], meta });
    });

    it('drops empty query params', async () => {
      const result = firstValueFrom(
        api.getPage('/search/dogs', {
          q: '',
          size: 'SMALL',
          breedId: undefined,
          neuteredOnly: true,
        }),
      );
      const req = http.expectOne((r) => r.url === '/api/search/dogs');
      expect(req.request.params.keys().sort()).toEqual(['neuteredOnly', 'size']);
      expect(req.request.params.get('neuteredOnly')).toBe('true');
      req.flush({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
      await result;
    });

    it('returns undefined for 204 responses and sends a body with DELETE', async () => {
      const result = firstValueFrom(api.delete('/users/me', { password: 'pass1' }));
      const req = http.expectOne('/api/users/me');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({ password: 'pass1' });
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(await result).toBeUndefined();
    });

    it('turns API errors into ApiError with field errors', async () => {
      const result = firstValueFrom(api.post('/auth/register', {}));
      http.expectOne('/api/auth/register').flush(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: [{ location: 'body', path: 'email', message: 'Invalid email address' }],
          },
        },
        { status: 400, statusText: 'Bad Request' },
      );

      const err = await result.catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
      expect((err as ApiError).fieldError('email')).toBe('Invalid email address');
      expect((err as ApiError).fieldError('password')).toBeUndefined();
    });

    it('reports a NETWORK_ERROR when the server does not answer', async () => {
      const result = firstValueFrom(api.get('/health'));
      http.expectOne('/api/health').error(new ProgressEvent('error'), { status: 0 });
      expect(await result.catch((e: unknown) => e)).toMatchObject({
        status: 0,
        code: 'NETWORK_ERROR',
      });
    });
  });

  describe('authInterceptor', () => {
    it('adds the token only to API requests', async () => {
      tokens.set('abc');

      const apiCall = firstValueFrom(api.get('/auth/me'));
      const apiReq = http.expectOne('/api/auth/me');
      expect(apiReq.request.headers.get('Authorization')).toBe('Bearer abc');
      apiReq.flush({ data: {} });
      await apiCall;

      const external = firstValueFrom(TestBed.inject(HttpClient).get('https://example.com/x'));
      const externalReq = http.expectOne('https://example.com/x');
      expect(externalReq.request.headers.has('Authorization')).toBe(false);
      externalReq.flush({});
      await external;
    });

    it('sends no header when logged out', async () => {
      const result = firstValueFrom(api.get('/breeds'));
      const req = http.expectOne('/api/breeds');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({ data: [] });
      await result;
    });

    it('clears the token and goes to /login when the session expires', async () => {
      tokens.set('expired');
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      const result = firstValueFrom(api.get('/auth/me'));
      http
        .expectOne('/api/auth/me')
        .flush(
          { error: { code: 'TOKEN_EXPIRED', message: 'expired' } },
          { status: 401, statusText: 'Unauthorized' },
        );

      expect(await result.catch((e: unknown) => e)).toMatchObject({ code: 'TOKEN_EXPIRED' });
      expect(tokens.token()).toBeNull();
      expect(window.localStorage.getItem('dogapp.auth.token')).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { reason: 'session-expired' },
      });
    });

    it('does not log out on a failed login (no token, INVALID_CREDENTIALS)', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

      const result = firstValueFrom(api.post('/auth/login', { email: 'a@b.c', password: 'x' }));
      http
        .expectOne('/api/auth/login')
        .flush(
          { error: { code: 'INVALID_CREDENTIALS', message: 'no' } },
          { status: 401, statusText: 'Unauthorized' },
        );

      expect(await result.catch((e: unknown) => e)).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('TokenStorageService', () => {
    it('keeps the token across a reload', () => {
      tokens.set('persisted');
      expect(window.localStorage.getItem('dogapp.auth.token')).toBe('persisted');
      TestBed.resetTestingModule();
      expect(TestBed.inject(TokenStorageService).token()).toBe('persisted');
    });
  });

  describe('BreedApiService (example)', () => {
    it('loads the breeds', async () => {
      const breed = {
        id: 'b1',
        name: 'Beagle',
        size: 'MEDIUM' as const,
        careTips: '-',
        heatSensitive: false,
        breathingIssues: false,
        energyLevel: 4,
      };
      const result = firstValueFrom(TestBed.inject(BreedApiService).list());
      http.expectOne('/api/breeds').flush({ data: [breed] });
      expect(await result).toEqual([breed]);
    });
  });
});
