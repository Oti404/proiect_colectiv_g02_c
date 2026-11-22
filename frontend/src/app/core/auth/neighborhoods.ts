/**
 * API-ul păstrează doar coordonate aproximative (2 zecimale), nu cartiere.
 * Frontend-ul arată un cartier: la înregistrare / editare trimite coordonatele cartierului ales,
 * iar la afișare alege cartierul cel mai apropiat de coordonatele din API.
 *
 * Centrele aproximative ale cartierelor din Cluj-Napoca, cu 2 zecimale, ca în API.
 */
export const NEIGHBORHOOD_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Centru: { lat: 46.77, lng: 23.59 },
  Gheorgheni: { lat: 46.77, lng: 23.62 },
  Mănăștur: { lat: 46.75, lng: 23.55 },
  Zorilor: { lat: 46.75, lng: 23.58 },
  Mărăști: { lat: 46.78, lng: 23.61 },
  Grigorescu: { lat: 46.77, lng: 23.56 },
  'Bună Ziua': { lat: 46.75, lng: 23.6 },
};

export const NEIGHBORHOODS = Object.keys(NEIGHBORHOOD_COORDINATES);

export function coordinatesOf(neighborhood: string): { latitude: number; longitude: number } {
  const coords = NEIGHBORHOOD_COORDINATES[neighborhood] ?? NEIGHBORHOOD_COORDINATES['Centru'];
  return { latitude: coords.lat, longitude: coords.lng };
}

export function nearestNeighborhood(latitude: number, longitude: number): string {
  let best = 'Centru';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [name, coords] of Object.entries(NEIGHBORHOOD_COORDINATES)) {
    const distance = (coords.lat - latitude) ** 2 + (coords.lng - longitude) ** 2;
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}
