import type { ToolContext } from "../../shared/types.js";

export function proposePaymentPlan(ctx: ToolContext, args: Record<string, unknown>) {
  const invoiceId = args.invoiceId as string;
  const installments = Math.max(2, Math.min(6, Number(args.installments) || 3));
  const intervalDays = Number(args.intervalDays) || 30;
  const inv = ctx.store.invoices.find((i) => i.id === invoiceId);
  if (!inv) {
    return { error: "invoice_not_found", invoiceId };
  }
  const balance = inv.amountInr - inv.paidInr;
  const perInstallment = Math.ceil(balance / installments);
  const schedule = Array.from({ length: installments }, (_, i) => ({
    installment: i + 1,
    amountInr: i === installments - 1 ? balance - perInstallment * (installments - 1) : perInstallment,
    dueInDays: intervalDays * (i + 1),
  }));
  return {
    invoiceId,
    balanceInr: balance,
    installments,
    intervalDays,
    schedule,
    message:
      "Payment plan is a proposal only — queue_send after client agrees (with approval).",
  };
}