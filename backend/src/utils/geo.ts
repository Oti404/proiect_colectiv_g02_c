/**
 * Rotunjește o coordonată la 2 zecimale (~1 km), ca să nu salvăm locația exactă a utilizatorului.
 * Number.EPSILON corectează cazuri ca 1.005 → 1.01 (altfel ar da 1.00 din cauza virgulei mobile).
 */
export function roundCoordinate(value: number): number {
  return Math.round((value + Number.EPSILON * Math.sign(value)) * 100) / 100;
}

export function roundLocation(latitude: number, longitude: number): { latitude: number; longitude: number } {
  return { latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude) };
}

const EARTH_RADIUS_KM = 6371;
const toRadians = (deg: number) => (deg * Math.PI) / 180;

/** Distanța în km între două puncte (formula haversine). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
