import { PlaceSource, PlaceType } from './enums';

export interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  neighborhood: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  type: PlaceType;
  source: PlaceSource;
}
