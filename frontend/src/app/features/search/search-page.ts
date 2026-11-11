import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AgeGroup, DogSize, DogSearchFilters, Temperament } from '../../core/models';
import {
  DEFAULT_SEARCH_FILTERS,
  DemoAuthService,
  DogService,
  MessageService,
  SearchService,
} from '../../core/services';

@Component({
  selector: 'app-search-page',
  imports: [RouterLink],
  templateUrl: './search-page.html',
})
export class SearchPageComponent {
  private readonly auth = inject(DemoAuthService);
  private readonly dogService = inject(DogService);
  private readonly searchService = inject(SearchService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  readonly currentUser = this.auth.currentUser;
  readonly breeds = this.dogService.breeds;

  readonly filters = signal<DogSearchFilters>({ ...DEFAULT_SEARCH_FILTERS });

  readonly results = computed(() => this.searchService.searchDogs(this.filters()));

  updateQuery(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.filters.update((f) => ({ ...f, query: value }));
  }

  updateBreed(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filters.update((f) => ({ ...f, breedId: value || null }));
  }

  updateSize(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as DogSize | '';
    this.filters.update((f) => ({ ...f, size: value || null }));
  }

  updateTemperament(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as Temperament | '';
    this.filters.update((f) => ({ ...f, temperament: value || null }));
  }

  updateAgeGroup(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AgeGroup;
    this.filters.update((f) => ({ ...f, ageGroup: value }));
  }

  updateNeuteredOnly(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.filters.update((f) => ({ ...f, neuteredOnly: checked }));
  }

  updateMaxDistance(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.filters.update((f) => ({ ...f, maxDistanceKm: value }));
  }

  onResetFilters(): void {
    this.filters.set({ ...DEFAULT_SEARCH_FILTERS });
  }

  onMessageOwner(ownerId: string): void {
    const res = this.messageService.startOrOpenConversation(ownerId);
    if (res.ok && res.data) {
      void this.router.navigate(['/messages', res.data.id]);
    }
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
