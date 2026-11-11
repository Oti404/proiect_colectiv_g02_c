import { AgeGroup, DogSize, Temperament } from './enums';
import { Breed, Dog } from './dog.model';
import { User } from './user.model';

export interface DogSearchFilters {
  query: string;
  breedId: string | null;
  size: DogSize | null;
  temperament: Temperament | null;
  ageGroup: AgeGroup;
  neuteredOnly: boolean;
  maxDistanceKm: number;
}

export interface DogSearchResult {
  dog: Dog;
  breed: Breed;
  owner: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl' | 'neighborhood'>;
  ageLabel: string;
  distanceKm: number;
}
