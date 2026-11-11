import { Injectable, inject } from '@angular/core';
import { Place, PlaceType } from '../models';
import { DemoStateService } from '../state/demo-state.service';

@Injectable({ providedIn: 'root' })
export class PlaceService {
  private readonly store = inject(DemoStateService);

  getPlaces(typeFilter: PlaceType | 'ALL' = 'ALL'): Place[] {
    const places = this.store.state().places;
    if (typeFilter === 'ALL') {
      return places;
    }
    return places.filter((p) => p.type === typeFilter);
  }

  getPlaceById(placeId: string): Place | undefined {
    return this.store.state().places.find((p) => p.id === placeId);
  }

  getExternalDirectionsUrl(place: Place): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
  }
}
