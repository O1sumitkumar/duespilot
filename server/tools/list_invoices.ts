import type { ToolContext } from "../../shared/types.js";

export function listInvoices(ctx: ToolContext, args: Record<string, unknown>) {
  let list = [...ctx.store.invoices];
  const status = args.status as string | undefined;
  if (args.overdueOnly === true) {
    list = list.filter((i) => i.status === "overdue" || i.status === "partial");
  } else if (status && status !== "all") {
    list = list.filter((i) => i.status === status);
  }
  if (typeof args.clientId === "string") {
    list = list.filter((i) => i.clientId === args.clientId);
  }
  if (typeof args.dueBefore === "string") {
    const d = args.dueBefore;
    list = list.filter((i) => i.dueAt <= d);
  }
  return list.map((i) => ({
    id: i.id,
    clientId: i.clientId,
    number: i.number,
    amountInr: i.amountInr,
    paidInr: i.paidInr,
    balanceInr: i.amountInr - i.paidInr,
    dueAt: i.dueAt,
    status: i.status,
    description: i.description,
  }));
}