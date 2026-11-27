import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import { ApiModel, Page } from '../api/api.types';
import { AgeGroup, DogSize, Temperament } from '../models';

export type ApiDogSearchResult = ApiModel<'DogSearchResult'>;

export interface DogSearchFilters {
  query: string;
  breedId: string | null;
  size: DogSize | null;
  temperament: Temperament | null;
  ageGroup: AgeGroup;
  neuteredOnly: boolean;
  maxDistanceKm: number;
}

export interface DogSearchQuery extends DogSearchFilters {
  page?: number;
  pageSize?: number;
}

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
  private readonly api = inject(ApiService);

  searchDogs(filters: DogSearchQuery): Observable<Page<ApiDogSearchResult>> {
    return this.api.getPage<ApiDogSearchResult>('/search/dogs', {
      q: filters.query.trim() || undefined,
      breedId: filters.breedId || undefined,
      size: filters.size || undefined,
      temperament: filters.temperament || undefined,
      ageGroup: filters.ageGroup === 'ALL' ? undefined : filters.ageGroup,
      neuteredOnly: filters.neuteredOnly ? true : undefined,
      maxDistanceKm: filters.maxDistanceKm,
      page: filters.page,
      pageSize: filters.pageSize,
    });
  }
}
