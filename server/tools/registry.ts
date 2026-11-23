import type { ToolName, ToolContext } from "../../shared/types.js";
import { listInvoices } from "./list_invoices.js";
import { getClient } from "./get_client.js";
import { readThread } from "./read_thread.js";
import { draftReminder } from "./draft_reminder.js";
import { scheduleFollowup } from "./schedule_followup.js";
import { proposePaymentPlan } from "./propose_payment_plan.js";
import { queueSend } from "./queue_send.js";
import { escalate } from "./escalate.js";
import { markWrittenOff } from "./mark_written_off.js";

export type ToolHandler = (
  ctx: ToolContext,
  args: Record<string, unknown>
) => Promise<unknown> | unknown;

export const TOOL_HANDLERS: Record<ToolName, ToolHandler> = {
  list_invoices: listInvoices,
  get_client: getClient,
  read_thread: readThread,
  draft_reminder: draftReminder,
  schedule_followup: scheduleFollowup,
  propose_payment_plan: proposePaymentPlan,
  queue_send: queueSend,
  escalate: escalate,
  mark_written_off: markWrittenOff,
};

export const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "list_invoices",
      description: "List invoices with optional filters",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["overdue", "partial", "sent", "disputed", "paid", "all"],
          },
          overdueOnly: { type: "boolean" },
          dueBefore: { type: "string" },
          clientId: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_client",
      description: "Get client profile by id",
      parameters: {
        type: "object",
        properties: { clientId: { type: "string" } },
        required: ["clientId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_thread",
      description: "Read email thread for a client",
      parameters: {
        type: "object",
        properties: { clientId: { type: "string" }, threadId: { type: "string" } },
        required: ["clientId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "draft_reminder",
      description: "Draft a polite payment reminder",
      parameters: {
        type: "object",
        properties: {
          invoiceId: { type: "string" },
          lang: { type: "string", enum: ["en", "hi", "hinglish"] },
          tone: { type: "string", enum: ["professional", "warm", "firm"] },
        },
        required: ["invoiceId", "lang", "tone"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "schedule_followup",
      description: "Schedule a calendar follow-up",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "string" },
          title: { type: "string" },
          at: { type: "string", description: "ISO date-time of the follow-up" },
          invoiceId: { type: "string" },
          channel: { type: "string", enum: ["email", "whatsapp", "call"] },
        },
        required: ["clientId", "title", "at"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_payment_plan",
      description: "Propose installment plan for an invoice",
      parameters: {
        type: "object",
        properties: {
          invoiceId: { type: "string" },
          installments: { type: "number" },
          intervalDays: { type: "number" },
        },
        required: ["invoiceId", "installments"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "queue_send",
      description: "Queue email for human approval before sending",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "string" },
          invoiceId: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
          lang: { type: "string", enum: ["en", "hi", "hinglish"] },
        },
        required: ["clientId", "invoiceId", "subject", "body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "escalate",
      description: "Escalate to human operator with summary",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "string" },
          reason: { type: "string" },
          summary: { type: "string" },
        },
        required: ["reason", "summary"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "mark_written_off",
      description: "Request approval to write off an invoice",
      parameters: {
        type: "object",
        properties: {
          invoiceId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["invoiceId", "reason"],
      },
    },
  },
];

export async function executeTool(
  ctx: ToolContext,
  name: ToolName,
  args: Record<string, unknown>
): Promise<unknown> {
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handler(ctx, args);
}