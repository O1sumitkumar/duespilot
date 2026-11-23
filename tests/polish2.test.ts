import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAgent } from "../server/agent/runner.js";
import { loadStore, resetStore, seedForClock } from "../server/data/store.js";
import { SEED_DATA } from "../server/data/seed.js";
import { checkBeforeTool, recordReminderSent } from "../server/guardrails/index.js";
import { mockPlan } from "../server/planner/mockPlanner.js";
import { seedShiftDays, shiftDateString } from "../shared/clock.js";
import {
  approvalActionLabel,
  runStatusLabel,
  summarizeStep,
} from "../client/src/stepUi.js";

const COLLECT = "Recover what's overdue this week";
const HINDI = "Draft Hindi/Hinglish reminders for overdue clients";

describe("language re-draft vs idempotency", () => {
  beforeEach(() => {
    process.env.DUESPILOT_REFERENCE_DATE = "2025-11-22";
    resetStore();
  });
  afterEach(() => {
    delete process.env.DUESPILOT_REFERENCE_DATE;
  });

  it("pending (unapproved) queued reminders do not block a Hindi/Hinglish re-draft", async () => {
    const store = loadStore();
    await runAgent(store, COLLECT, { plannerMode: "mock", dryRun: true });
    expect(store.reminderLog).toHaveLength(0);
    const pendingBefore = store.approvals.filter((a) => a.status === "pending").length;
    expect(pendingBefore).toBeGreaterThan(0);

    const run = await runAgent(store, HINDI, { plannerMode: "mock", dryRun: true });
    const drafts = run.steps.filter((s) => s.tool === "draft_reminder");
    expect(drafts.length).toBeGreaterThanOrEqual(2);
    expect(drafts.every((s) => !s.blocked)).toBe(true);
    const langs = drafts.map((s) => (s.args as { lang: string }).lang).sort();
    expect(langs).toEqual(["hi", "hinglish"]);

    // Older pending items for the same invoices are superseded, not duplicated.
    const pendingAfter = store.approvals.filter((a) => a.status === "pending");
    expect(pendingAfter).toHaveLength(pendingBefore);
    const perInvoice = new Map<string, number>();
    for (const a of pendingAfter) {
      const id = String(a.payload.invoiceId);
      perInvoice.set(id, (perInvoice.get(id) ?? 0) + 1);
    }
    expect([...perInvoice.values()].every((n) => n === 1)).toBe(true);
    expect(store.approvals.some((a) => a.status === "superseded")).toBe(true);
  });

  it("an approved (sent) reminder still enforces the 7-day cooldown", async () => {
    const store = loadStore();
    recordReminderSent(store, "inv01");
    expect(checkBeforeTool(store, "queue_send", { invoiceId: "inv01" }).allow).toBe(false);
    expect(checkBeforeTool(store, "draft_reminder", { invoiceId: "inv01" }).allow).toBe(false);
    // Planner skips the already-sent invoice instead of tripping the guardrail.
    const plan = mockPlan(HINDI, store);
    expect(plan.some((c) => c.args.invoiceId === "inv01")).toBe(false);
  });

  it("collections queue keeps each client's drafted language", async () => {
    const store = loadStore();
    await runAgent(store, COLLECT, { plannerMode: "mock", dryRun: true });
    const hindi = store.approvals.find((a) => a.payload.invoiceId === "inv03");
    expect(String(hindi?.payload.body)).toMatch(/[\u0900-\u097F]/);
  });
});

describe("step + status labels", () => {
  it("schedule_followup summary shows date, channel and invoice", () => {
    const s = summarizeStep({
      index: 0,
      tool: "schedule_followup",
      args: {},
      at: new Date().toISOString(),
      result: {
        scheduled: {
          id: "ev",
          title: "Follow up DP-101",
          at: "2025-11-27T06:30:00.000Z",
          type: "followup",
          channel: "whatsapp",
          invoiceId: "inv01",
          invoiceNumber: "DP-101",
        },
        clientName: "Aarav Mehta",
      },
    });
    expect(s).toContain("27 Nov");
    expect(s).toContain("WhatsApp");
    expect(s).toContain("DP-101");
    expect(s).not.toMatch(/^Scheduled:\s*$/);
  });

  it("renders human labels instead of raw enums", () => {
    expect(runStatusLabel("awaiting_approval")).toBe("Awaiting approval");
    expect(runStatusLabel("handed_off")).toBe("Handed off to human");
    expect(approvalActionLabel("queue_send")).toBe("Send reminder");
    expect(runStatusLabel("some_new_state")).toBe("Some new state");
  });
});

describe("seed dates follow the demo clock", () => {
  afterEach(() => {
    delete process.env.DUESPILOT_REFERENCE_DATE;
  });

  it("shifts invoice/thread dates relative to the reference date", () => {
    process.env.DUESPILOT_REFERENCE_DATE = "2026-12-05";
    const days = seedShiftDays();
    expect(days).toBe(378);
    const seed = seedForClock(days);
    const inv03 = seed.invoices.find((i) => i.id === "inv03")!;
    const orig = SEED_DATA.invoices.find((i) => i.id === "inv03")!;
    expect(inv03.dueAt).toBe(shiftDateString(orig.dueAt, days));
    expect(inv03.dueAt.startsWith("2026-")).toBe(true);
    // Overdue invoices stay due before the demo clock's dueBefore.
    for (const i of seed.invoices.filter((x) => x.status === "overdue")) {
      expect(i.dueAt <= "2026-12-05").toBe(true);
    }
    expect(shiftDateString("2025-11-21T10:00:00+05:30", 1)).toBe("2025-11-22T10:00:00+05:30");
  });

  it("is a no-op at the seed's authored reference date", () => {
    process.env.DUESPILOT_REFERENCE_DATE = "2025-11-22";
    expect(seedShiftDays()).toBe(0);
  });
});
