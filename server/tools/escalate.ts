import type { ToolContext } from "../../shared/types.js";
import { newId } from "../data/store.js";

export function escalate(ctx: ToolContext, args: Record<string, unknown>) {
  const clientId = args.clientId as string | undefined;
  const reason = args.reason as string;
  const summary = args.summary as string;
  const clientName = ctx.store.clients.find((c) => c.id === clientId)?.name;
  const item = {
    id: newId("ap"),
    runId: ctx.runId,
    createdAt: new Date().toISOString(),
    action: "escalate" as const,
    status: "pending" as const,
    payload: { clientId, reason, summary },
    summary: `Hand off to human: ${String(reason ?? "review").replace(/_/g, " ")}${
      clientName ? ` — ${clientName}` : ""
    }`,
  };
  ctx.store.approvals.push(item);
  return {
    approvalId: item.id,
    status: "escalation_queued",
    handoffSummary: summary,
  };
}