/** Synthetic dataset is authored relative to this "collections as-of" date. */
export const SEED_REFERENCE_DATE = "2025-11-22";

/**
 * Injectable clock for runs and tests (`DUESPILOT_REFERENCE_DATE=YYYY-MM-DD`).
 * Defaults to the real current time so `dueBefore` filters stay fresh in demos.
 */
export function getReferenceNow(): Date {
  const env = process.env.DUESPILOT_REFERENCE_DATE?.trim();
  if (env) {
    const d = new Date(env.includes("T") ? env : `${env}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Inclusive upper bound for "due this week / earlier" list filters. */
export function dueBeforeForCollectionsWeek(now = getReferenceNow()): string {
  return toISODate(now);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days between the seed's authored "as-of" date and the demo clock.
 * The synthetic dataset is shifted by this many days on seed so overdue ages,
 * thread dates and `dueBefore` filters stay consistent with the demo clock.
 */
export function seedShiftDays(now = getReferenceNow()): number {
  const ref = Date.parse(`${SEED_REFERENCE_DATE}T00:00:00.000Z`);
  const today = Date.parse(`${toISODate(now)}T00:00:00.000Z`);
  return Math.round((today - ref) / DAY_MS);
}

/** Shift a `YYYY-MM-DD` or ISO datetime string by whole days, preserving its format. */
export function shiftDateString(value: string, days: number): string {
  if (!days) return value;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (dateOnly) {
    const d = new Date(`${value}T00:00:00.000Z`);
    return toISODate(new Date(d.getTime() + days * DAY_MS));
  }
  const m = value.match(/^(\d{4}-\d{2}-\d{2})(T.*)$/);
  if (m) {
    return `${shiftDateString(m[1], days)}${m[2]}`;
  }
  return value;
}
