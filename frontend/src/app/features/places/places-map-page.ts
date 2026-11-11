import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Place, PlaceType } from '../../core/models';
import { PlaceService } from '../../core/services';

type PlaceFilter = PlaceType | 'ALL';

@Component({
  selector: 'app-places-map-page',
  imports: [RouterLink],
  templateUrl: './places-map-page.html',
})
export class PlacesMapPageComponent {
  private readonly placeService = inject(PlaceService);

  readonly categoryOptions: { value: PlaceFilter; label: string }[] = [
    { value: 'ALL', label: 'All Places' },
    { value: 'PARK', label: 'Parks' },
    { value: 'DOG_PARK', label: 'Dog Parks' },
    { value: 'CAFE', label: 'Dog-Friendly Cafes' },
    { value: 'VET', label: 'Vet Clinics' },
    { value: 'PET_SHOP', label: 'Pet Shops' },
  ];

  readonly activeCategory = signal<PlaceFilter>('ALL');
  readonly searchQuery = signal<string>('');
  readonly selectedPlaceId = signal<string | null>(null);

  readonly filteredPlaces = computed<Place[]>(() => {
    const byCategory = this.placeService.getPlaces(this.activeCategory());
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) {
      return byCategory;
    }
    return byCategory.filter(
      (place) =>
        place.name.toLowerCase().includes(q) ||
        place.neighborhood.toLowerCase().includes(q) ||
        (place.address?.toLowerCase().includes(q) ?? false),
    );
  });

  readonly selectedPlace = computed<Place | null>(() => {
    const list = this.filteredPlaces();
    if (list.length === 0) {
      return null;
    }
    const currentId = this.selectedPlaceId();
    return list.find((p) => p.id === currentId) ?? list[0] ?? null;
  });

  setCategory(category: PlaceFilter): void {
    this.activeCategory.set(category);
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.searchQuery.set(input ? input.value : '');
  }

  selectPlace(placeId: string): void {
    this.selectedPlaceId.set(placeId);
  }

  getDirectionsUrl(place: Place): string {
    return this.placeService.getExternalDirectionsUrl(place);
  }

  formatPlaceType(type: PlaceType): string {
    switch (type) {
      case 'PARK':
        return 'Park';
      case 'DOG_PARK':
        return 'Dog Park';
      case 'CAFE':
        return 'Dog-Friendly Cafe';
      case 'VET':
        return 'Vet Clinic';
      case 'PET_SHOP':
        return 'Pet Shop';
    }
  }
}
