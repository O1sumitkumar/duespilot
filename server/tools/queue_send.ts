import type { ToolContext } from "../../shared/types.js";
import { newId } from "../data/store.js";

export function queueSend(ctx: ToolContext, args: Record<string, unknown>) {
  const clientId = args.clientId as string;
  const invoiceId = args.invoiceId as string;
  const subject = args.subject as string;
  const body = args.body as string;
  const inv = ctx.store.invoices.find((i) => i.id === invoiceId);
  const balance = inv ? inv.amountInr - inv.paidInr : 0;
  const item = {
    id: newId("ap"),
    runId: ctx.runId,
    createdAt: new Date().toISOString(),
    action: "queue_send" as const,
    status: "pending" as const,
    payload: { clientId, invoiceId, subject, body, balanceInr: balance },
    summary: `Send reminder to ${clientId} for ${invoiceId} (₹${balance.toLocaleString("en-IN")})`,
  };
  ctx.store.approvals.push(item);
  return {
    approvalId: item.id,
    status: "queued_for_approval",
    message: "Email was NOT sent. Awaiting human approval.",
  };
}