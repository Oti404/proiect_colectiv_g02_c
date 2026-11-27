import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api/api.types';
import { authInterceptor } from '../api/auth.interceptor';
import { CareService } from './care.service';

describe('CareService (API)', () => {
  let http: HttpTestingController;
  let service: CareService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CareService);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists health records with optional type filter', async () => {
    const allPromise = firstValueFrom(service.getHealthRecords('dog-1', 'ALL'));
    const allReq = http.expectOne('/api/dogs/dog-1/health-records');
    expect(allReq.request.params.has('type')).toBe(false);
    allReq.flush({ data: [] });
    expect(await allPromise).toEqual([]);

    const vaccinePromise = firstValueFrom(service.getHealthRecords('dog-1', 'VACCINE'));
    const vaccineReq = http.expectOne((r) => r.url === '/api/dogs/dog-1/health-records');
    expect(vaccineReq.request.params.get('type')).toBe('VACCINE');
    vaccineReq.flush({ data: [{ id: 'hr-1', type: 'VACCINE', title: 'Rabies' }] });
    expect((await vaccinePromise)[0].title).toBe('Rabies');
  });

  it('creates, updates, and deletes a health record and surfaces validation field errors', async () => {
    const badPromise = firstValueFrom(
      service.createHealthRecord('dog-1', {
        type: 'WEIGHT',
        title: 'Monthly weigh-in',
        date: '2026-11-26',
        weightKg: null,
      }),
    );
    const badReq = http.expectOne('/api/dogs/dog-1/health-records');
    expect(badReq.request.method).toBe('POST');
    badReq.flush(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [{ location: 'body', path: 'weightKg', message: 'weightKg is required' }],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );

    try {
      await badPromise;
      expect.unreachable('should have rejected');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('VALIDATION_ERROR');
      expect(apiErr.fieldError('weightKg')).toBe('weightKg is required');
    }

    const patchPromise = firstValueFrom(
      service.updateHealthRecord('dog-1', 'hr-1', { title: 'Updated Rabies' }),
    );
    const patchReq = http.expectOne('/api/dogs/dog-1/health-records/hr-1');
    expect(patchReq.request.method).toBe('PATCH');
    patchReq.flush({ data: { id: 'hr-1', title: 'Updated Rabies' } });
    expect((await patchPromise).title).toBe('Updated Rabies');

    const deletePromise = firstValueFrom(service.deleteHealthRecord('dog-1', 'hr-1'));
    const deleteReq = http.expectOne('/api/dogs/dog-1/health-records/hr-1');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null, { status: 204, statusText: 'No Content' });
    await deletePromise;
  });

  it('fetches reminders, weight history, and daily tip', async () => {
    const remindersPromise = firstValueFrom(service.getReminders('dog-1'));
    http.expectOne('/api/dogs/dog-1/reminders').flush({ data: [] });
    expect(await remindersPromise).toEqual([]);

    const weightPromise = firstValueFrom(service.getWeightHistory('dog-1'));
    http
      .expectOne('/api/dogs/dog-1/weight-history')
      .flush({ data: [{ id: 'w1', title: 'Weigh-in', date: '2026-11-01', weightKg: 24.5 }] });
    expect((await weightPromise)[0].weightKg).toBe(24.5);

    const tipPromise = firstValueFrom(service.getDailyTip('dog-1'));
    http.expectOne('/api/dogs/dog-1/daily-tip').flush({
      data: {
        headline: 'Balanced routine',
        advice: 'Two walks today',
        isWarning: false,
        disclaimer: 'Informational only.',
      },
    });
    expect((await tipPromise).headline).toBe('Balanced routine');
  });
});
