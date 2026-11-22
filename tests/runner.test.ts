import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAgent } from "../server/agent/runner.js";
import { loadStore, resetStore } from "../server/data/store.js";
import { mockPlan } from "../server/planner/mockPlanner.js";

describe("runner", () => {
  beforeEach(() => {
    resetStore();
    process.env.DUESPILOT_REFERENCE_DATE = "2025-11-22";
  });

  afterEach(() => {
    delete process.env.DUESPILOT_REFERENCE_DATE;
  });

  it("marks dispute escalation as handed_off, not awaiting_approval", async () => {
    const store = loadStore();
    const run = await runAgent(store, "Handle disputed invoice — escalate safely", {
      plannerMode: "mock",
      dryRun: true,
    });
    expect(run.steps.some((s) => s.tool === "escalate")).toBe(true);
    expect(run.status).toBe("handed_off");
  });

  it("mock default plan uses derived dueBefore, not stale hard-coded date", () => {
    const store = loadStore();
    const plan = mockPlan("Recover what's overdue this week", store);
    const list = plan.find((p) => p.tool === "list_invoices");
    expect(list?.args.dueBefore).toBe("2025-11-22");
    expect(list?.args.dueBefore).not.toBe("2025-11-21");
  });
});