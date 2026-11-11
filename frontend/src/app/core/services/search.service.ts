import { Injectable, inject } from '@angular/core';
import { DogSearchFilters, DogSearchResult } from '../models';
import { DemoStateService } from '../state/demo-state.service';
import { calculateApproxDistanceKm } from '../../shared/utils/distance.util';
import { formatDogAge, getDogAgeGroup } from '../../shared/utils/dog-age.util';
import { DemoAuthService } from './demo-auth.service';
import { UserService } from './user.service';

export const DEFAULT_SEARCH_FILTERS: DogSearchFilters = {
  query: '',
  breedId: null,
  size: null,
  temperament: null,
  ageGroup: 'ALL',
  neuteredOnly: false,
  maxDistanceKm: 10,
};

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly store = inject(DemoStateService);
  private readonly auth = inject(DemoAuthService);
  private readonly userService = inject(UserService);

  searchDogs(filters: DogSearchFilters): DogSearchResult[] {
    const me = this.auth.currentUser();
    if (!me) {
      return [];
    }

    const state = this.store.state();
    const queryLower = filters.query.trim().toLowerCase();

    const results: DogSearchResult[] = [];

    for (const dog of state.dogs) {
      if (dog.ownerId === me.id) {
        continue;
      }
      if (this.userService.isBlockedEitherWay(me.id, dog.ownerId)) {
        continue;
      }

      const owner = state.users.find((u) => u.id === dog.ownerId);
      const breed = state.breeds.find((b) => b.id === dog.breedId);
      if (!owner || !breed) {
        continue;
      }

      const distanceKm = calculateApproxDistanceKm(
        me.approxLatitude,
        me.approxLongitude,
        owner.approxLatitude,
        owner.approxLongitude,
      );

      if (distanceKm > filters.maxDistanceKm) {
        continue;
      }
      if (filters.breedId && dog.breedId !== filters.breedId) {
        continue;
      }
      if (filters.size && dog.size !== filters.size) {
        continue;
      }
      if (filters.temperament && dog.temperament !== filters.temperament) {
        continue;
      }
      if (filters.neuteredOnly && !dog.neutered) {
        continue;
      }
      if (filters.ageGroup !== 'ALL') {
        const group = getDogAgeGroup(dog.birthDate);
        if (group !== filters.ageGroup) {
          continue;
        }
      }
      if (queryLower) {
        const matchesQuery =
          dog.name.toLowerCase().includes(queryLower) ||
          breed.name.toLowerCase().includes(queryLower) ||
          owner.firstName.toLowerCase().includes(queryLower) ||
          owner.neighborhood.toLowerCase().includes(queryLower);
        if (!matchesQuery) {
          continue;
        }
      }

      results.push({
        dog,
        breed,
        owner: {
          id: owner.id,
          firstName: owner.firstName,
          lastName: owner.lastName,
          avatarUrl: owner.avatarUrl,
          neighborhood: owner.neighborhood,
        },
        ageLabel: formatDogAge(dog.birthDate),
        distanceKm,
      });
    }

    return results.sort((a, b) => a.distanceKm - b.distanceKm);
  }
}
