import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from '../api/auth.interceptor';
import { DEFAULT_SEARCH_FILTERS, SearchService } from './search.service';

describe('SearchService (API)', () => {
  let http: HttpTestingController;
  let service: SearchService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SearchService);
  });

  afterEach(() => {
    http.verify();
  });

  it('sends non-empty filter query params and unwraps paginated results', async () => {
    const promise = firstValueFrom(
      service.searchDogs({
        ...DEFAULT_SEARCH_FILTERS,
        query: '  Luna  ',
        breedId: 'breed-1',
        size: 'MEDIUM',
        temperament: 'FRIENDLY',
        ageGroup: 'ADULT',
        neuteredOnly: true,
        maxDistanceKm: 15,
        page: 2,
        pageSize: 12,
      }),
    );

    const req = http.expectOne((r) => r.url === '/api/search/dogs');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('Luna');
    expect(req.request.params.get('breedId')).toBe('breed-1');
    expect(req.request.params.get('size')).toBe('MEDIUM');
    expect(req.request.params.get('temperament')).toBe('FRIENDLY');
    expect(req.request.params.get('ageGroup')).toBe('ADULT');
    expect(req.request.params.get('neuteredOnly')).toBe('true');
    expect(req.request.params.get('maxDistanceKm')).toBe('15');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('12');

    req.flush({
      data: [
        {
          id: 'dog-1',
          ownerId: 'user-2',
          breedId: 'breed-1',
          name: 'Luna',
          birthDate: '2023-05-01T00:00:00.000Z',
          sex: 'FEMALE',
          size: 'MEDIUM',
          temperament: 'FRIENDLY',
          neutered: true,
          photoUrl: null,
          createdAt: '2026-10-05T09:00:00.000Z',
          updatedAt: '2026-10-05T09:00:00.000Z',
          breed: {
            id: 'breed-1',
            name: 'Beagle',
            size: 'MEDIUM',
            careTips: 'Walks',
            heatSensitive: false,
            breathingIssues: false,
            energyLevel: 4,
          },
          owner: {
            id: 'user-2',
            firstName: 'Elena',
            lastName: 'Rusu',
            avatarUrl: null,
            bio: null,
            approxLatitude: 46.77,
            approxLongitude: 23.62,
          },
          ageGroup: 'ADULT',
          distanceKm: 1.8,
        },
      ],
      meta: { page: 2, pageSize: 12, total: 13, totalPages: 2 },
    });

    const page = await promise;
    expect(page.items).toHaveLength(1);
    expect(page.items[0].name).toBe('Luna');
    expect(page.meta.totalPages).toBe(2);
  });

  it('omits empty filters, ALL ageGroup, and false neuteredOnly', async () => {
    const promise = firstValueFrom(service.searchDogs({ ...DEFAULT_SEARCH_FILTERS }));

    const req = http.expectOne((r) => r.url === '/api/search/dogs');
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('breedId')).toBe(false);
    expect(req.request.params.has('size')).toBe(false);
    expect(req.request.params.has('temperament')).toBe(false);
    expect(req.request.params.has('ageGroup')).toBe(false);
    expect(req.request.params.has('neuteredOnly')).toBe(false);
    expect(req.request.params.get('maxDistanceKm')).toBe('10');

    req.flush({ data: [], meta: { page: 1, pageSize: 12, total: 0, totalPages: 1 } });
    const page = await promise;
    expect(page.items).toEqual([]);
  });
});
