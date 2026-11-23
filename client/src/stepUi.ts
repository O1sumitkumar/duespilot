import type { RunStep } from "../../shared/types.js";

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
      return summarizeFollowup(r);
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

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  call: "Call",
};

export function formatFollowupDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "date TBD";
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function summarizeFollowup(r: Record<string, unknown>): string {
  const ev = (r.scheduled ?? r) as Record<string, unknown>;
  const parts = [`Follow-up ${formatFollowupDate(String(ev.at ?? ""))}`];
  const channel = typeof ev.channel === "string" ? CHANNEL_LABELS[ev.channel] ?? ev.channel : null;
  if (channel) parts.push(`via ${channel}`);
  const inv = ev.invoiceNumber ?? ev.invoiceId;
  if (inv) parts.push(`for ${String(inv)}`);
  if (typeof r.clientName === "string") parts.push(`(${r.clientName})`);
  if (parts.length === 1 && ev.title) parts.push(`· ${String(ev.title)}`);
  return parts.join(" ");
}

const RUN_STATUS_LABELS: Record<string, string> = {
  running: "Running",
  awaiting_approval: "Awaiting approval",
  completed: "Completed",
  failed: "Failed",
  handed_off: "Handed off to human",
};

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABELS[status] ?? humanizeEnum(status);
}

const APPROVAL_ACTION_LABELS: Record<string, string> = {
  queue_send: "Send reminder",
  escalate: "Escalation",
  mark_written_off: "Write-off",
};

export function approvalActionLabel(action: string): string {
  return APPROVAL_ACTION_LABELS[action] ?? humanizeEnum(action);
}

export function humanizeEnum(value: string): string {
  const s = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return s ? s[0].toUpperCase() + s.slice(1) : value;
}
