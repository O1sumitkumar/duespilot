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