import { AgeGroup } from '../../core/models';
import { DEMO_REFERENCE_DATE_ISO } from './date.util';

export function calculateDogAgeYears(
  birthDate: string | null,
  referenceIso: string = DEMO_REFERENCE_DATE_ISO,
): number | null {
  if (!birthDate) {
    return null;
  }
  const birth = new Date(birthDate);
  const ref = new Date(referenceIso);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(ref.getTime())) {
    return null;
  }
  const diffMs = ref.getTime() - birth.getTime();
  if (diffMs < 0) {
    return 0;
  }
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

export function getDogAgeGroup(
  birthDate: string | null,
  referenceIso: string = DEMO_REFERENCE_DATE_ISO,
): Exclude<AgeGroup, 'ALL'> | null {
  const years = calculateDogAgeYears(birthDate, referenceIso);
  if (years === null) {
    return null;
  }
  if (years < 1.5) {
    return 'PUPPY';
  }
  if (years < 7) {
    return 'ADULT';
  }
  return 'SENIOR';
}

export function formatDogAge(
  birthDate: string | null,
  referenceIso: string = DEMO_REFERENCE_DATE_ISO,
): string {
  const years = calculateDogAgeYears(birthDate, referenceIso);
  if (years === null) {
    return 'Age unknown';
  }
  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12));
    return `${months} mo`;
  }
  const wholeYears = Math.floor(years);
  return wholeYears === 1 ? '1 yr' : `${wholeYears} yrs`;
}
