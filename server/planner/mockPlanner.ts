import type { DataStore, ToolName } from "../../shared/types.js";

export interface PlannedCall {
  tool: ToolName;
  args: Record<string, unknown>;
}

const GOAL_HANDLERS: { match: RegExp; plan: (store: DataStore) => PlannedCall[] }[] = [
  {
    match: /list.*overdue|review overdue/i,
    plan: () => [{ tool: "list_invoices", args: { overdueOnly: true } }],
  },
  {
    match: /dispute|angry|escalat/i,
    plan: (store) => {
      const disputed = store.invoices.find((i) => i.status === "disputed");
      return [
        { tool: "list_invoices", args: { status: "disputed" } },
        ...(disputed
          ? ([
              { tool: "read_thread" as const, args: { clientId: disputed.clientId } },
              {
                tool: "escalate" as const,
                args: {
                  clientId: disputed.clientId,
                  reason: "disputed_invoice",
                  summary: "Dispute detected on overdue collections run — human review required.",
                },
              },
            ] satisfies PlannedCall[])
          : []),
      ];
    },
  },
  {
    match: /payment plan|installment|split/i,
    plan: (store) => {
      const partial = store.invoices.find(
        (i) => i.status === "partial" || i.clientId === "c03"
      );
      if (!partial) {
        return [{ tool: "list_invoices", args: { status: "partial" } }];
      }
      return [
        { tool: "get_client", args: { clientId: partial.clientId } },
        { tool: "read_thread", args: { clientId: partial.clientId } },
        { tool: "propose_payment_plan", args: { invoiceId: partial.id, installments: 3 } },
        { tool: "schedule_followup", args: {
            clientId: partial.clientId,
            title: "Confirm payment plan",
            at: new Date(Date.now() + 3 * 86400000).toISOString(),
          },
        },
      ];
    },
  },
  {
    match: /hindi|hinglish|हिंदी/i,
    plan: (store) => {
      const inv = store.invoices.find(
        (i) => i.status === "overdue" && store.clients.find((c) => c.id === i.clientId)?.preferredLang !== "en"
      );
      if (!inv) {
        return [{ tool: "list_invoices", args: { overdueOnly: true } }];
      }
      const client = store.clients.find((c) => c.id === inv.clientId)!;
      const lang = client.preferredLang === "hi" ? "hi" : "hinglish";
      return [
        { tool: "get_client", args: { clientId: inv.clientId } },
        {
          tool: "draft_reminder",
          args: { invoiceId: inv.id, lang, tone: "warm" },
        },
        {
          tool: "queue_send",
          args: {
            clientId: inv.clientId,
            invoiceId: inv.id,
            subject: `Payment reminder: ${inv.number}`,
            body: "(Draft from prior step)",
          },
        },
      ];
    },
  },
  {
    match: /write.?off|bad debt/i,
    plan: () => [
      { tool: "list_invoices", args: { status: "overdue" } },
      {
        tool: "mark_written_off",
        args: { invoiceId: "inv21", reason: "Legacy — already marked in books" },
      },
    ],
  },
  {
    match: /big|50,?000|high.?value|lakh/i,
    plan: (store) => {
      const big = store.invoices.find(
        (i) => i.status === "overdue" && i.amountInr - i.paidInr > 50000
      );
      if (!big) {
        return [{ tool: "list_invoices", args: { overdueOnly: true } }];
      }
      return [
        { tool: "list_invoices", args: { overdueOnly: true } },
        { tool: "get_client", args: { clientId: big.clientId } },
        {
          tool: "draft_reminder",
          args: { invoiceId: big.id, lang: "en", tone: "professional" },
        },
        {
          tool: "queue_send",
          args: {
            clientId: big.clientId,
            invoiceId: big.id,
            subject: `Important: ${big.number}`,
            body: "Professional reminder for high-value invoice",
          },
        },
      ];
    },
  },
];

export function mockPlan(goal: string, store: DataStore): PlannedCall[] {
  for (const h of GOAL_HANDLERS) {
    if (h.match.test(goal)) {
      return h.plan(store);
    }
  }
  // Default: recover overdue this week
  const overdue = store.invoices.filter((i) => i.status === "overdue").slice(0, 4);
  const calls: PlannedCall[] = [
    { tool: "list_invoices", args: { overdueOnly: true, dueBefore: "2025-11-21" } },
  ];
  for (const inv of overdue) {
    const client = store.clients.find((c) => c.id === inv.clientId);
    const lang = client?.preferredLang ?? "en";
    calls.push({ tool: "read_thread", args: { clientId: inv.clientId } });
    calls.push({
      tool: "draft_reminder",
      args: {
        invoiceId: inv.id,
        lang: lang === "hi" ? "hi" : lang === "hinglish" ? "hinglish" : "en",
        tone: inv.amountInr - inv.paidInr > 30000 ? "firm" : "warm",
      },
    });
    if (inv.clientId === "c10") {
      calls.push({
        tool: "propose_payment_plan",
        args: { invoiceId: inv.id, installments: 2 },
      });
    }
    calls.push({
      tool: "schedule_followup",
      args: {
        clientId: inv.clientId,
        title: `Follow up ${inv.number}`,
        at: new Date(Date.now() + 5 * 86400000).toISOString(),
      },
    });
    calls.push({
      tool: "queue_send",
      args: {
        clientId: inv.clientId,
        invoiceId: inv.id,
        subject: `Payment reminder: ${inv.number}`,
        body: "See drafted body in trace",
      },
    });
  }
  return calls;
}