import { describe, expect, it, beforeEach } from "vitest";
import { resetStore, loadStore } from "../server/data/store.js";
import { executeTool } from "../server/tools/registry.js";
import { listInvoices } from "../server/tools/list_invoices.js";
import { draftReminder } from "../server/tools/draft_reminder.js";

describe("tools", () => {
  beforeEach(() => {
    resetStore();
  });

  it("list_invoices filters overdue", () => {
    const store = loadStore();
    const ctx = { runId: "t", store, audit: () => {} };
    const rows = listInvoices(ctx, { overdueOnly: true }) as Array<{ status: string }>;
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.every((r) => r.status === "overdue" || r.status === "partial")).toBe(true);
  });

  it("draft_reminder supports Hindi", () => {
    const store = loadStore();
    const inv = store.invoices.find((i) => i.clientId === "c03" && i.status === "overdue");
    expect(inv).toBeDefined();
    const ctx = { runId: "t", store, audit: () => {} };
    const draft = draftReminder(ctx, {
      invoiceId: inv!.id,
      lang: "hi",
      tone: "warm",
    }) as { body: string };
    expect(draft.body).toMatch(/चालान|नमस्ते|₹/);
  });

  it("queue_send never marks sent", async () => {
    const store = loadStore();
    const inv = store.invoices.find((i) => i.status === "overdue");
    const ctx = { runId: "t", store, audit: () => {} };
    const res = (await executeTool(ctx, "queue_send", {
      clientId: inv!.clientId,
      invoiceId: inv!.id,
      subject: "Test",
      body: "Test body",
    })) as { status: string; message: string };
    expect(res.status).toBe("queued_for_approval");
    expect(res.message.toLowerCase()).toContain("not sent");
  });
});