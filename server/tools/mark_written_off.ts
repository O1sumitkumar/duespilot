import type { ToolContext } from "../../shared/types.js";
import { newId } from "../data/store.js";

export function markWrittenOff(ctx: ToolContext, args: Record<string, unknown>) {
  const invoiceId = args.invoiceId as string;
  const reason = args.reason as string;
  const inv = ctx.store.invoices.find((i) => i.id === invoiceId);
  if (!inv) {
    return { error: "invoice_not_found", invoiceId };
  }
  const item = {
    id: newId("ap"),
    runId: ctx.runId,
    createdAt: new Date().toISOString(),
    action: "mark_written_off" as const,
    status: "pending" as const,
    payload: { invoiceId, reason, amountInr: inv.amountInr - inv.paidInr },
    summary: `Write off ${inv.number}: ${reason}`,
  };
  ctx.store.approvals.push(item);
  return {
    approvalId: item.id,
    status: "writeoff_queued",
    message: "Invoice status unchanged until approved.",
  };
}