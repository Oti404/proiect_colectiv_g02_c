import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { BreedApiService } from '../../core/api/breed-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { nearestNeighborhood } from '../../core/auth/neighborhoods';
import { AgeGroup, DogSize, Temperament } from '../../core/models';
import {
  DEFAULT_SEARCH_FILTERS,
  DogSearchFilters,
  DogSearchQuery,
  SearchService,
} from '../../core/services';
import { formatDogAge } from '../../shared/utils/dog-age.util';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 12;

@Component({
  selector: 'app-search-page',
  imports: [RouterLink],
  templateUrl: './search-page.html',
})
export class SearchPageComponent {
  private readonly auth = inject(AuthService);
  private readonly breedApi = inject(BreedApiService);
  private readonly searchService = inject(SearchService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser = this.auth.user;
  readonly currentUserNeighborhood = computed(() => {
    const user = this.currentUser();
    return user ? nearestNeighborhood(user.approxLatitude, user.approxLongitude) : null;
  });

  readonly breedsResource = rxResource({
    stream: () => this.breedApi.list(),
  });
  readonly breeds = computed(() => this.breedsResource.value() ?? []);

  readonly filters = signal<DogSearchFilters>({ ...DEFAULT_SEARCH_FILTERS });
  readonly debouncedQuery = signal<string>('');
  readonly page = signal<number>(1);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly searchParams = computed<DogSearchQuery>(() => ({
    ...this.filters(),
    query: this.debouncedQuery(),
    page: this.page(),
    pageSize: PAGE_SIZE,
  }));

  readonly resultsResource = rxResource({
    params: () => this.searchParams(),
    stream: ({ params }) => this.searchService.searchDogs(params),
  });

  readonly results = computed(() => this.resultsResource.value()?.items ?? []);
  readonly meta = computed(
    () =>
      this.resultsResource.value()?.meta ?? {
        page: 1,
        pageSize: PAGE_SIZE,
        total: 0,
        totalPages: 1,
      },
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
    });
  }

  updateQuery(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.filters.update((f) => ({ ...f, query: value }));

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.page.set(1);
      this.debouncedQuery.set(value);
    }, SEARCH_DEBOUNCE_MS);
  }

  updateBreed(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.page.set(1);
    this.filters.update((f) => ({ ...f, breedId: value || null }));
  }

  updateSize(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as DogSize | '';
    this.page.set(1);
    this.filters.update((f) => ({ ...f, size: value || null }));
  }

  updateTemperament(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as Temperament | '';
    this.page.set(1);
    this.filters.update((f) => ({ ...f, temperament: value || null }));
  }

  updateAgeGroup(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AgeGroup;
    this.page.set(1);
    this.filters.update((f) => ({ ...f, ageGroup: value }));
  }

  updateNeuteredOnly(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.page.set(1);
    this.filters.update((f) => ({ ...f, neuteredOnly: checked }));
  }

  updateMaxDistance(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.page.set(1);
    this.filters.update((f) => ({ ...f, maxDistanceKm: value }));
  }

  onResetFilters(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.page.set(1);
    this.debouncedQuery.set('');
    this.filters.set({ ...DEFAULT_SEARCH_FILTERS });
  }

  goToPage(nextPage: number): void {
    const totalPages = Math.max(1, this.meta().totalPages);
    if (nextPage < 1 || nextPage > totalPages || nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
  }

  retrySearch(): void {
    this.resultsResource.reload();
  }

  onMessageOwner(ownerId: string): void {
    void this.router.navigate(['/messages'], { queryParams: { with: ownerId } });
  }

  onInvitePlaydate(ownerId: string): void {
    void this.router.navigate(['/events/new'], {
      queryParams: {
        inviteUserId: ownerId,
        type: 'PLAYDATE',
        visibility: 'PRIVATE',
      },
    });
  }

  ownerNeighborhood(lat: number, lng: number): string {
    return nearestNeighborhood(lat, lng);
  }

  dogAgeLabel(birthDate: string | null): string {
    return formatDogAge(birthDate, new Date().toISOString());
  }

  getTemperamentBadgeClass(temperament: Temperament): string {
    switch (temperament) {
      case 'FRIENDLY':
        return 'badge badge-success';
      case 'PLAYFUL':
        return 'badge badge-info';
      case 'SHY':
        return 'badge badge-warn';
      case 'REACTIVE':
        return 'badge badge-danger';
    }
  }
}
