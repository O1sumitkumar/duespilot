import type { ToolContext } from "../../shared/types.js";
import { newId } from "../data/store.js";

export function escalate(ctx: ToolContext, args: Record<string, unknown>) {
  const clientId = args.clientId as string | undefined;
  const reason = args.reason as string;
  const summary = args.summary as string;
  const item = {
    id: newId("ap"),
    runId: ctx.runId,
    createdAt: new Date().toISOString(),
    action: "escalate" as const,
    status: "pending" as const,
    payload: { clientId, reason, summary },
    summary: `Escalation: ${reason}`,
  };
  ctx.store.approvals.push(item);
  return {
    approvalId: item.id,
    status: "escalation_queued",
    handoffSummary: summary,
  };
}