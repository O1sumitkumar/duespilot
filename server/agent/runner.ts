import {
  DEFAULT_MAX_STEPS,
  type AgentRun,
  type DataStore,
  type RunStep,
  type ToolName,
} from "../../shared/types.js";
import { newId, saveStore } from "../data/store.js";
import {
  checkBeforeTool,
  isUnsafeAction,
  recordReminderSent,
} from "../guardrails/index.js";
import { planWithFallback } from "../planner/llmPlanner.js";
import { draftReminder } from "../tools/draft_reminder.js";
import { executeTool } from "../tools/registry.js";

export interface RunOptions {
  plannerMode: "mock" | "llm";
  maxSteps?: number;
  llmBaseUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
  onStep?: (run: AgentRun) => void;
  /** Eval mode: skip persisting store between steps except at end */
  dryRun?: boolean;
}

export async function runAgent(
  store: DataStore,
  goal: string,
  opts: RunOptions
): Promise<AgentRun> {
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  const runId = newId("run");
  const run: AgentRun = {
    id: runId,
    goal,
    status: "running",
    startedAt: new Date().toISOString(),
    steps: [],
    plannerMode: opts.plannerMode,
  };
  store.runs.push(run);

  const audit = (entry: Omit<import("../../shared/types.js").AuditEntry, "id" | "at" | "runId">) =>
    pushAudit(store, { ...entry, runId });

  audit({ type: "run_start", message: goal });

  const { calls, mode } = await planWithFallback(goal, store, opts.plannerMode, {
    baseUrl: opts.llmBaseUrl ?? "",
    apiKey: opts.llmApiKey ?? "",
    model: opts.llmModel ?? "gpt-4o-mini",
    maxSteps,
  });
  run.plannerMode = mode;
  audit({ type: "planner", message: `Planner: ${mode}, ${calls.length} planned calls` });

  let stepIndex = 0;
  let handedOff = false;

  for (const call of calls) {
    if (stepIndex >= maxSteps) {
      audit({ type: "guardrail", message: "Max step budget reached" });
      run.status = "completed";
      run.summary = "Stopped: max steps reached";
      break;
    }
    if (handedOff) {
      break;
    }

    const guard = checkBeforeTool(store, call.tool, call.args);
    audit({
      type: "guardrail",
      tool: call.tool,
      args: call.args,
      message: guard.allow ? "allowed" : guard.reason,
    });

    let args = { ...call.args };
    if (call.tool === "queue_send" && args.body === "See drafted body in trace") {
      const draft = draftReminder(
        { runId, store, audit: () => {} },
        {
          invoiceId: args.invoiceId as string,
          lang: "en",
          tone: "professional",
        }
      ) as { body?: string; subject?: string };
      if (draft.body) {
        args = { ...args, body: draft.body, subject: draft.subject ?? args.subject };
      }
    }
    if (call.tool === "queue_send" && args.body === "(Draft from prior step)") {
      const lastDraft = [...run.steps].reverse().find((s) => s.tool === "draft_reminder");
      const dr = lastDraft?.result as { body?: string; subject?: string } | undefined;
      if (dr?.body) {
        args = { ...args, body: dr.body, subject: dr.subject ?? args.subject };
      }
    }

    const ctx = {
      runId,
      store,
      audit: (e: Omit<import("../../shared/types.js").AuditEntry, "id" | "at" | "runId">) =>
        pushAudit(store, { ...e, runId }),
    };

    let result: unknown;
    let blocked = false;
    let blockReason: string | undefined;

    if (!guard.allow) {
      blocked = true;
      blockReason = guard.reason;
      result = { blocked: true, reason: guard.reason };
      if (guard.forceHandoff) {
        handedOff = true;
        const esc = await executeTool(ctx, "escalate", {
          clientId: args.clientId,
          reason: "guardrail_handoff",
          summary: guard.reason ?? "Handoff",
        });
        result = esc;
        const step: RunStep = {
          index: stepIndex++,
          tool: call.tool,
          args,
          result,
          at: new Date().toISOString(),
          blocked,
          blockReason,
        };
        run.steps.push(step);
        audit({ type: "tool_call", tool: call.tool, args, result });
        opts.onStep?.(run);
        run.status = "handed_off";
        run.summary = guard.reason;
        break;
      }
    } else {
      result = await executeTool(ctx, call.tool as ToolName, args);
      if (isUnsafeAction(call.tool, result)) {
        run.status = "failed";
        run.summary = "Unsafe action detected";
        audit({ type: "guardrail", message: "UNSAFE_ACTION", result });
      }
      if (call.tool === "queue_send") {
        const invId = args.invoiceId as string;
        recordReminderSent(store, invId);
      }
    }

    const step: RunStep = {
      index: stepIndex++,
      tool: call.tool,
      args,
      result,
      at: new Date().toISOString(),
      blocked,
      blockReason,
    };
    run.steps.push(step);
    audit({ type: "tool_call", tool: call.tool, args, result });
    opts.onStep?.(run);

    const approvalsPending = store.approvals.filter(
      (a) => a.runId === runId && a.status === "pending"
    );
    if (approvalsPending.length > 0 && !handedOff) {
      run.status = "awaiting_approval";
    }
  }

  if (run.status === "running") {
    run.status = run.steps.some((s) => s.tool === "escalate") ? "handed_off" : "completed";
    run.summary =
      run.summary ??
      `Completed ${run.steps.length} steps; ${store.approvals.filter((a) => a.runId === runId).length} approval(s) queued.`;
  }

  run.endedAt = new Date().toISOString();
  audit({ type: "run_end", message: run.status });

  if (!opts.dryRun) {
    saveStore(store);
  }
  return run;
}

function pushAudit(
  store: DataStore,
  entry: Omit<import("../../shared/types.js").AuditEntry, "id" | "at">
): void {
  store.audits.push({
    id: newId("aud"),
    at: new Date().toISOString(),
    ...entry,
  });
}