export type InvoiceStatus =
  | "draft"
  | "sent"
  | "overdue"
  | "partial"
  | "paid"
  | "disputed"
  | "written_off";

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  preferredLang: "en" | "hi" | "hinglish";
  notes?: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  number: string;
  amountInr: number;
  paidInr: number;
  currency: "INR";
  issuedAt: string;
  dueAt: string;
  status: InvoiceStatus;
  description: string;
  disputeReason?: string;
}

export interface ThreadMessage {
  id: string;
  from: "agency" | "client";
  at: string;
  subject?: string;
  body: string;
  sentiment?: "neutral" | "polite" | "angry" | "dispute";
}

export interface EmailThread {
  id: string;
  clientId: string;
  invoiceIds: string[];
  messages: ThreadMessage[];
}

export interface CalendarEvent {
  id: string;
  clientId?: string;
  title: string;
  at: string;
  type: "followup" | "call" | "internal";
  invoiceId?: string;
  invoiceNumber?: string;
  channel?: "email" | "whatsapp" | "call";
}

export interface ApprovalItem {
  id: string;
  runId: string;
  createdAt: string;
  action: "queue_send" | "escalate" | "mark_written_off";
  status: "pending" | "approved" | "rejected" | "superseded";
  supersededBy?: string;
  payload: Record<string, unknown>;
  summary: string;
}

export interface AuditEntry {
  id: string;
  runId: string;
  at: string;
  type: "tool_call" | "guardrail" | "approval" | "run_start" | "run_end" | "planner";
  tool?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  message?: string;
}

export interface AgentRun {
  id: string;
  goal: string;
  status: "running" | "awaiting_approval" | "completed" | "failed" | "handed_off";
  startedAt: string;
  endedAt?: string;
  steps: RunStep[];
  summary?: string;
  plannerMode: "mock" | "llm";
}

export interface RunStep {
  index: number;
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
  at: string;
  blocked?: boolean;
  blockReason?: string;
}

export interface DataStore {
  clients: Client[];
  invoices: Invoice[];
  threads: EmailThread[];
  calendar: CalendarEvent[];
  approvals: ApprovalItem[];
  audits: AuditEntry[];
  runs: AgentRun[];
  reminderLog: { invoiceId: string; at: string }[];
  version: number;
}

export type ToolName =
  | "list_invoices"
  | "get_client"
  | "read_thread"
  | "draft_reminder"
  | "schedule_followup"
  | "propose_payment_plan"
  | "queue_send"
  | "escalate"
  | "mark_written_off";

export interface ToolContext {
  runId: string;
  store: DataStore;
  audit: (entry: Omit<AuditEntry, "id" | "at" | "runId">) => void;
}

export interface PlannerConfig {
  mode: "mock" | "llm";
  maxSteps: number;
  llmBaseUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
}

export const BIG_TICKET_INR = 50_000;
export const REMINDER_COOLDOWN_DAYS = 7;
export const DEFAULT_MAX_STEPS = 25;