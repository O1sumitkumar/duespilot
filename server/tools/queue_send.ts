import type { ToolContext } from "../../shared/types.js";
import { newId } from "../data/store.js";

const LANG_LABELS: Record<string, string> = { en: "English", hi: "Hindi", hinglish: "Hinglish" };

export function queueSend(ctx: ToolContext, args: Record<string, unknown>) {
  const clientId = args.clientId as string;
  const invoiceId = args.invoiceId as string;
  const subject = args.subject as string;
  const body = args.body as string;
  const inv = ctx.store.invoices.find((i) => i.id === invoiceId);
  const balance = inv ? inv.amountInr - inv.paidInr : 0;
  const lang = typeof args.lang === "string" ? args.lang : undefined;
  const client = ctx.store.clients.find((c) => c.id === clientId);
  const item = {
    id: newId("ap"),
    runId: ctx.runId,
    createdAt: new Date().toISOString(),
    action: "queue_send" as const,
    status: "pending" as const,
    payload: { clientId, invoiceId, subject, body, balanceInr: balance, ...(lang ? { lang } : {}) },
    summary: `Send reminder to ${client?.name ?? clientId}${lang ? ` (${LANG_LABELS[lang] ?? lang})` : ""} for ${inv?.number ?? invoiceId} (₹${balance.toLocaleString("en-IN")})`,
  };

  // A newer draft for the same invoice replaces an older *unapproved* one, so a
  // language re-draft never leaves two competing sends in the queue. Nothing has
  // been sent yet, so this does not weaken send idempotency (see guardrails).
  const superseded: string[] = [];
  for (const prev of ctx.store.approvals) {
    if (
      prev.action === "queue_send" &&
      prev.status === "pending" &&
      prev.payload.invoiceId === invoiceId
    ) {
      prev.status = "superseded";
      prev.supersededBy = item.id;
      superseded.push(prev.id);
      const prevRun = ctx.store.runs.find((r) => r.id === prev.runId);
      if (
        prevRun &&
        prevRun.id !== ctx.runId &&
        prevRun.status === "awaiting_approval" &&
        !ctx.store.approvals.some((a) => a.runId === prevRun.id && a.status === "pending")
      ) {
        prevRun.status = "completed";
      }
    }
  }

  ctx.store.approvals.push(item);
  return {
    approvalId: item.id,
    status: "queued_for_approval",
    superseded,
    message:
      superseded.length > 0
        ? `Email was NOT sent. Replaced ${superseded.length} older unapproved draft(s); awaiting human approval.`
        : "Email was NOT sent. Awaiting human approval.",
  };
}
