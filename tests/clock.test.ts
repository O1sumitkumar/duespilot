import { afterEach, describe, expect, it } from "vitest";
import {
  SEED_REFERENCE_DATE,
  dueBeforeForCollectionsWeek,
  getReferenceNow,
  toISODate,
} from "../shared/clock.js";

describe("clock", () => {
  afterEach(() => {
    delete process.env.DUESPILOT_REFERENCE_DATE;
  });

  it("exposes seed reference date for docs/tests", () => {
    expect(SEED_REFERENCE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses injected reference date in tests", () => {
    process.env.DUESPILOT_REFERENCE_DATE = "2025-11-22";
    expect(toISODate(getReferenceNow())).toBe("2025-11-22");
    expect(dueBeforeForCollectionsWeek()).toBe("2025-11-22");
  });

  it("dueBefore tracks real today when env unset", () => {
    const today = toISODate(new Date());
    expect(dueBeforeForCollectionsWeek()).toBe(today);
  });
});