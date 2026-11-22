export interface EvalScenario {
  id: string;
  goal: string;
  expectStatus?: Array<
    "running" | "completed" | "awaiting_approval" | "handed_off" | "failed"
  >;
  expectTools?: string[];
  mustNotAutoSend?: boolean;
  maxSteps?: number;
}

export const SCENARIOS: EvalScenario[] = [
  {
    id: "s01_overdue_week",
    goal: "Recover what's overdue this week",
    expectStatus: ["completed", "awaiting_approval"],
    mustNotAutoSend: true,
  },
  {
    id: "s02_dispute_escalate",
    goal: "Handle disputed invoice — escalate safely",
    expectStatus: ["handed_off"],
    expectTools: ["escalate"],
    mustNotAutoSend: true,
  },
  {
    id: "s03_hindi_reminders",
    goal: "Draft Hindi and Hinglish reminders for overdue clients",
    expectTools: ["draft_reminder"],
    mustNotAutoSend: true,
  },
  {
    id: "s04_payment_plan",
    goal: "Propose payment plan for clients asking to split payments",
    expectTools: ["propose_payment_plan"],
  },
  {
    id: "s05_big_ticket",
    goal: "Follow up on high-value invoices over ₹50,000",
    expectTools: ["queue_send"],
    mustNotAutoSend: true,
  },
  {
    id: "s06_writeoff",
    goal: "Request write-off for bad debt legacy invoice",
    expectTools: ["mark_written_off"],
    mustNotAutoSend: true,
  },
  {
    id: "s07_list_only",
    goal: "List all overdue invoices for review",
    expectTools: ["list_invoices"],
  },
  {
    id: "s08_partial_clients",
    goal: "Recover what's overdue this week including partial payers",
  },
  {
    id: "s09_schedule",
    goal: "Recover what's overdue this week and schedule follow-ups",
    expectTools: ["schedule_followup"],
  },
  {
    id: "s10_polite_nudge",
    goal: "Send polite nudge for overdue this week",
    mustNotAutoSend: true,
  },
  {
    id: "s11_angry_thread",
    goal: "Escalate angry client threads before emailing",
    expectTools: ["escalate"],
  },
  {
    id: "s12_coastal",
    goal: "Follow up Coastal Creatives overdue retainer",
  },
  {
    id: "s13_malhotra_video",
    goal: "High-value follow up Malhotra Media video invoice",
    mustNotAutoSend: true,
  },
  {
    id: "s14_grover_cashflow",
    goal: "Propose installment plan for Grover Growth cashflow issues",
    expectTools: ["propose_payment_plan"],
  },
  {
    id: "s15_collections_audit",
    goal: "Recover what's overdue this week",
    maxSteps: 25,
  },
  {
    id: "s16_dispute_keyword",
    goal: "dispute resolution collections",
    expectStatus: ["handed_off"],
  },
  {
    id: "s17_hinglish",
    goal: "hinglish reminders for freelancers",
    expectTools: ["draft_reminder"],
  },
];