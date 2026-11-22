import type { RunStep } from "../../shared/types";

export function summarizeStep(step: RunStep): string {
  const { tool, result } = step;
  if (result === null || result === undefined) return "—";
  if (Array.isArray(result)) {
    return `Listed ${result.length} invoice(s)`;
  }
  const r = result as Record<string, unknown>;
  if (r.error) return `Error: ${String(r.error)}`;
  if (r.blocked) return `Blocked: ${String(r.reason ?? step.blockReason ?? "guardrail")}`;

  switch (tool) {
    case "get_client":
      return `${String(r.name ?? "")} · ${String(r.company ?? "")}`.trim();
    case "read_thread": {
      const msgs = r.messages as unknown[] | undefined;
      const risk = r.risk as string | undefined;
      return `${msgs?.length ?? 0} message(s)${risk ? ` · ${risk}` : ""}`;
    }
    case "draft_reminder":
      return String(r.subject ?? "Draft reminder");
    case "queue_send":
      return String(r.message ?? r.status ?? "Queued for approval");
    case "escalate":
      return String(r.handoffSummary ?? "Escalation queued for human review");
    case "schedule_followup":
      return `Scheduled: ${String(r.title ?? "")}`;
    case "propose_payment_plan":
      return `Plan: ${String(r.installments ?? "?")} installments`;
    default:
      return typeof r.status === "string" ? r.status : "Completed";
  }
}

export function draftBodyFromStep(step: RunStep): string | null {
  if (step.tool !== "draft_reminder" || !step.result) return null;
  const body = (step.result as { body?: string }).body;
  return body?.trim() ? body : null;
}