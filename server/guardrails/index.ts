import {
  BIG_TICKET_INR,
  REMINDER_COOLDOWN_DAYS,
  type DataStore,
  type ToolName,
} from "../../shared/types.js";

export interface GuardrailResult {
  allow: boolean;
  reason?: string;
  forceHandoff?: boolean;
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

export function checkThreadRisks(store: DataStore, clientId: string): GuardrailResult {
  const threads = store.threads.filter((t) => t.clientId === clientId);
  for (const t of threads) {
    for (const m of t.messages) {
      if (m.sentiment === "angry" || m.sentiment === "dispute") {
        return {
          allow: false,
          forceHandoff: true,
          reason: `Thread risk detected (${m.sentiment}) for client ${clientId}`,
        };
      }
    }
  }
  return { allow: true };
}

export function checkBeforeTool(
  store: DataStore,
  tool: ToolName,
  args: Record<string, unknown>
): GuardrailResult {
  if (tool === "list_invoices" || tool === "get_client" || tool === "read_thread") {
    return { allow: true };
  }

  if (tool === "draft_reminder" || tool === "queue_send") {
    const invoiceId = args.invoiceId as string | undefined;
    if (invoiceId) {
      const inv = store.invoices.find((i) => i.id === invoiceId);
      if (inv?.status === "disputed") {
        return {
          allow: false,
          forceHandoff: true,
          reason: "Invoice is disputed — hand off to human",
        };
      }
      if (inv) {
        const threadCheck = checkThreadRisks(store, inv.clientId);
        if (!threadCheck.allow) {
          return threadCheck;
        }
      }
      const recent = store.reminderLog.filter((r) => r.invoiceId === invoiceId);
      for (const r of recent) {
        if (daysSince(r.at) < REMINDER_COOLDOWN_DAYS) {
          return {
            allow: false,
            reason: `Idempotency: reminder sent for ${invoiceId} within ${REMINDER_COOLDOWN_DAYS} days`,
          };
        }
      }
    }
  }

  if (tool === "queue_send" || tool === "escalate" || tool === "mark_written_off") {
    const invoiceId = args.invoiceId as string | undefined;
    if (invoiceId) {
      const inv = store.invoices.find((i) => i.id === invoiceId);
      if (inv) {
        const balance = inv.amountInr - inv.paidInr;
        if (balance > BIG_TICKET_INR && tool === "queue_send") {
          return {
            allow: true,
            reason: `Big-ticket ₹${balance} — approval required (handled by queue_send)`,
          };
        }
      }
    }
    const clientId = args.clientId as string | undefined;
    if (clientId && tool === "queue_send") {
      const threadCheck = checkThreadRisks(store, clientId);
      if (!threadCheck.allow) {
        return threadCheck;
      }
    }
  }

  return { allow: true };
}

export function recordReminderSent(store: DataStore, invoiceId: string): void {
  store.reminderLog.push({ invoiceId, at: new Date().toISOString() });
}

/** Unsafe if a message would be sent without going through approval queue */
export function isUnsafeAction(tool: ToolName, result: unknown): boolean {
  if (tool !== "queue_send" && tool !== "escalate" && tool !== "mark_written_off") {
    return false;
  }
  const r = result as Record<string, unknown>;
  if (r?.message && String(r.message).toLowerCase().includes("sent successfully")) {
    return true;
  }
  if (r?.status === "sent") {
    return true;
  }
  return false;
}