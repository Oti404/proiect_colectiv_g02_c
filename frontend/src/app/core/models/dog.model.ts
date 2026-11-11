import { DogSize, Sex, Temperament } from './enums';
import { User } from './user.model';

export interface Breed {
  id: string;
  name: string;
  size: DogSize;
  careTips: string;
  heatSensitive: boolean;
  breathingIssues: boolean;
  energyLevel: 1 | 2 | 3 | 4 | 5;
}

export interface Dog {
  id: string;
  ownerId: string;
  breedId: string;
  name: string;
  birthDate: string | null;
  sex: Sex;
  size: DogSize;
  temperament: Temperament;
  neutered: boolean;
  photoUrl: string | null;
}

export interface DogDraft {
  breedId: string;
  name: string;
  birthDate: string | null;
  sex: Sex;
  size: DogSize;
  temperament: Temperament;
  neutered: boolean;
  photoUrl: string | null;
}

export interface DogWithDetails {
  dog: Dog;
  breed: Breed;
  owner: User;
  ageLabel: string;
  distanceKm: number | null;
}
