import { describe, expect, it, beforeEach } from "vitest";
import { resetStore, loadStore } from "../server/data/store.js";
import {
  checkBeforeTool,
  checkThreadRisks,
  isUnsafeAction,
} from "../server/guardrails/index.js";
import { REMINDER_COOLDOWN_DAYS } from "../shared/types.js";

describe("guardrails", () => {
  beforeEach(() => {
    resetStore();
  });

  it("blocks disputed invoice reminders", () => {
    const store = loadStore();
    const g = checkBeforeTool(store, "draft_reminder", { invoiceId: "inv05" });
    expect(g.allow).toBe(false);
    expect(g.forceHandoff).toBe(true);
  });

  it("blocks angry thread client queue_send", () => {
    const store = loadStore();
    const g = checkBeforeTool(store, "queue_send", {
      clientId: "c05",
      invoiceId: "inv15",
    });
    expect(g.allow).toBe(false);
  });

  it("detects thread risks", () => {
    const store = loadStore();
    const g = checkThreadRisks(store, "c05");
    expect(g.allow).toBe(false);
  });

  it("enforces reminder cooldown", () => {
    const store = loadStore();
    store.reminderLog.push({
      invoiceId: "inv01",
      at: new Date().toISOString(),
    });
    const g = checkBeforeTool(store, "draft_reminder", { invoiceId: "inv01" });
    expect(g.allow).toBe(false);
    expect(g.reason).toContain(String(REMINDER_COOLDOWN_DAYS));
  });

  it("isUnsafeAction is false for queue_send approval", () => {
    expect(
      isUnsafeAction("queue_send", {
        status: "queued_for_approval",
        message: "Email was NOT sent",
      })
    ).toBe(false);
  });
});