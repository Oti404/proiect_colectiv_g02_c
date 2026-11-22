import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiModel } from './api.types';

export type ApiBreed = ApiModel<'Breed'>;

/**
 * Exemplul de urmat pentru un serviciu care vorbește cu API-ul (vezi README, „Legarea de backend”).
 *
 * Serviciul doar descrie apelurile și întoarce `Observable`. Starea (loading, eroare, date)
 * o ține componenta, cu `rxResource`:
 *
 *   private readonly breedApi = inject(BreedApiService);
 *   readonly breeds = rxResource({ stream: () => this.breedApi.list() });
 *
 *   // în template:
 *   @if (breeds.isLoading()) { <p>Se încarcă…</p> }
 *   @else if (breeds.error()) { <p class="error">Nu am putut încărca rasele.</p> }
 *   @else { @for (breed of breeds.value(); track breed.id) { … } }
 */
@Injectable({ providedIn: 'root' })
export class BreedApiService {
  private readonly api = inject(ApiService);

  /** Toate rasele, ordonate după nume. Rută publică. */
  list(): Observable<ApiBreed[]> {
    return this.api.get<ApiBreed[]>('/breeds');
  }
}
