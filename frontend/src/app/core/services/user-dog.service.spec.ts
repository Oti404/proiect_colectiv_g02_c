import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api/api.types';
import { authInterceptor } from '../api/auth.interceptor';
import { DogService } from './dog.service';
import { UserService } from './user.service';

describe('UserService & DogService (API)', () => {
  let http: HttpTestingController;
  let userService: UserService;
  let dogService: DogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    userService = TestBed.inject(UserService);
    dogService = TestBed.inject(DogService);
  });

  afterEach(() => {
    http.verify();
  });

  it('updates current user profile via PATCH /users/me', async () => {
    const promise = firstValueFrom(
      userService.updateMe({
        firstName: 'Ana',
        lastName: 'Popescu',
        bio: 'Dog lover',
        latitude: 46.77,
        longitude: 23.62,
      }),
    );

    const req = http.expectOne('/api/users/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      firstName: 'Ana',
      lastName: 'Popescu',
      bio: 'Dog lover',
      latitude: 46.77,
      longitude: 23.62,
    });
    req.flush({
      data: {
        id: 'u1',
        email: 'ana@demo.dogapp',
        emailVerified: true,
        firstName: 'Ana',
        lastName: 'Popescu',
        avatarUrl: null,
        bio: 'Dog lover',
        approxLatitude: 46.77,
        approxLongitude: 23.62,
        consentAt: '2026-10-05T09:00:00.000Z',
        createdAt: '2026-10-05T09:00:00.000Z',
        updatedAt: '2026-11-26T10:00:00.000Z',
      },
    });

    const user = await promise;
    expect(user.lastName).toBe('Popescu');
  });

  it('deletes account via DELETE /users/me and maps 403 INVALID_PASSWORD', async () => {
    const promise = firstValueFrom(userService.deleteMe('wrong'));
    const req = http.expectOne('/api/users/me');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ password: 'wrong' });
    req.flush(
      { error: { code: 'INVALID_PASSWORD', message: 'Invalid password' } },
      { status: 403, statusText: 'Forbidden' },
    );

    await expect(promise).rejects.toMatchObject({
      status: 403,
      code: 'INVALID_PASSWORD',
    } satisfies Partial<ApiError>);
  });

  it('fetches public profile, blocks, unblocks, and reports', async () => {
    const profilePromise = firstValueFrom(userService.getPublicProfile('u2'));
    http.expectOne('/api/users/u2').flush({
      data: {
        id: 'u2',
        firstName: 'Elena',
        lastName: 'Rusu',
        avatarUrl: null,
        bio: null,
        approxLatitude: 46.77,
        approxLongitude: 23.62,
        createdAt: '2026-10-05T09:00:00.000Z',
        dogs: [],
      },
    });
    expect((await profilePromise).firstName).toBe('Elena');

    const blockPromise = firstValueFrom(userService.block('u2'));
    const blockReq = http.expectOne('/api/blocks/u2');
    expect(blockReq.request.method).toBe('POST');
    blockReq.flush({
      data: {
        user: { id: 'u2', firstName: 'Elena', lastName: 'Rusu', avatarUrl: null },
        createdAt: '2026-11-26T10:00:00.000Z',
      },
    });
    expect((await blockPromise).user.id).toBe('u2');

    const unblockPromise = firstValueFrom(userService.unblock('u2'));
    const unblockReq = http.expectOne('/api/blocks/u2');
    expect(unblockReq.request.method).toBe('DELETE');
    unblockReq.flush(null, { status: 204, statusText: 'No Content' });
    await unblockPromise;

    const reportPromise = firstValueFrom(userService.reportUser('u2', 'Spam'));
    const reportReq = http.expectOne('/api/reports');
    expect(reportReq.request.method).toBe('POST');
    expect(reportReq.request.body).toEqual({ reportedUserId: 'u2', reason: 'Spam' });
    reportReq.flush(
      { error: { code: 'ALREADY_REPORTED', message: 'Already reported' } },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(reportPromise).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_REPORTED',
    } satisfies Partial<ApiError>);
  });

  it('performs Dog CRUD via /dogs and /dogs/:id', async () => {
    const createPromise = firstValueFrom(
      dogService.create({
        breedId: 'b1',
        name: 'Biscuit',
        sex: 'MALE',
        size: 'MEDIUM',
        temperament: 'FRIENDLY',
        neutered: true,
        birthDate: '2024-01-10',
        photoUrl: null,
      }),
    );
    const createReq = http.expectOne('/api/dogs');
    expect(createReq.request.method).toBe('POST');
    createReq.flush(
      {
        data: {
          id: 'd1',
          ownerId: 'u1',
          breedId: 'b1',
          name: 'Biscuit',
          birthDate: '2024-01-10T00:00:00.000Z',
          sex: 'MALE',
          size: 'MEDIUM',
          temperament: 'FRIENDLY',
          neutered: true,
          photoUrl: null,
          createdAt: '2026-11-26T10:00:00.000Z',
          updatedAt: '2026-11-26T10:00:00.000Z',
          breed: {
            id: 'b1',
            name: 'Beagle',
            size: 'MEDIUM',
            careTips: 'Walks',
            heatSensitive: false,
            breathingIssues: false,
            energyLevel: 4,
          },
        },
      },
      { status: 201, statusText: 'Created' },
    );
    expect((await createPromise).id).toBe('d1');

    const patchPromise = firstValueFrom(dogService.update('d1', { name: 'Biscuit Jr' }));
    const patchReq = http.expectOne('/api/dogs/d1');
    expect(patchReq.request.method).toBe('PATCH');
    patchReq.flush({ data: { id: 'd1', name: 'Biscuit Jr' } });
    expect((await patchPromise).name).toBe('Biscuit Jr');

    const deletePromise = firstValueFrom(dogService.delete('d1'));
    const deleteReq = http.expectOne('/api/dogs/d1');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null, { status: 204, statusText: 'No Content' });
    await deletePromise;
  });
});
