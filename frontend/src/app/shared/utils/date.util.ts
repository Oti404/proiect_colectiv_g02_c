/**
 * Single configurable reference date for the frontend demo.
 * Seeded events, reminders, dog ages, and default form dates derive from this value
 * so future demos (e.g. January 2027+) never show seeded items as unintentionally expired
 * while keeping automated tests 100% deterministic.
 */
export const DEMO_REFERENCE_DATE_ISO = '2026-11-11T12:00:00.000Z';

function getReferenceUtcMidnightMs(referenceIso: string = DEMO_REFERENCE_DATE_ISO): number {
  const ref = new Date(referenceIso);
  if (Number.isNaN(ref.getTime())) {
    return Date.UTC(2026, 10, 11);
  }
  return Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
}

/**
 * Returns a deterministic YYYY-MM-DD date string offset by `daysOffset` days
 * from `DEMO_REFERENCE_DATE_ISO` (positive = future, negative = past).
 */
export function offsetDemoDateOnly(
  daysOffset: number,
  referenceIso: string = DEMO_REFERENCE_DATE_ISO,
): string {
  const shifted = new Date(getReferenceUtcMidnightMs(referenceIso) + daysOffset * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Returns a deterministic UTC ISO timestamp offset by `daysOffset` days from `DEMO_REFERENCE_DATE_ISO`.
 */
export function offsetDemoDateIso(
  daysOffset: number,
  utcTime: string = '12:00:00.000Z',
  referenceIso: string = DEMO_REFERENCE_DATE_ISO,
): string {
  return `${offsetDemoDateOnly(daysOffset, referenceIso)}T${utcTime}`;
}

/**
 * Returns a YYYY-MM-DDTHH:mm value suitable for `<input type="datetime-local">` controls.
 */
export function offsetDemoLocalDateTime(
  daysOffset: number,
  hour: number = 16,
  minute: number = 0,
  referenceIso: string = DEMO_REFERENCE_DATE_ISO,
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${offsetDemoDateOnly(daysOffset, referenceIso)}T${pad(hour)}:${pad(minute)}`;
}

export function isWithinNextDays(
  targetIso: string | null,
  days: number,
  referenceIso: string = DEMO_REFERENCE_DATE_ISO,
): boolean {
  if (!targetIso) {
    return false;
  }
  const target = new Date(targetIso).getTime();
  const ref = new Date(referenceIso).getTime();
  if (Number.isNaN(target) || Number.isNaN(ref)) {
    return false;
  }
  const maxMs = ref + days * 24 * 60 * 60 * 1000;
  return target >= ref && target <= maxMs;
}
