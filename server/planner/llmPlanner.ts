import type { DataStore, ToolName } from "../../shared/types.js";
import { TOOL_SCHEMAS } from "../tools/registry.js";
import type { PlannedCall } from "./mockPlanner.js";
import { mockPlan } from "./mockPlanner.js";

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export async function llmPlan(
  goal: string,
  store: DataStore,
  config: { baseUrl: string; apiKey: string; model: string; maxSteps: number }
): Promise<PlannedCall[]> {
  const system = `You are DuesPilot, a collections-ops agent for Indian freelancers.
Use tools to recover overdue payments. Never send email directly — always use queue_send.
If disputes or angry threads appear, use escalate and stop collection messages.
Respect big-ticket (>₹50,000) and approval flows. Plan at most ${config.maxSteps} tool calls.`;

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: `Goal: ${goal}\nContext: ${store.invoices.filter((i) => i.status === "overdue").length} overdue invoices in dataset.`,
    },
  ];

  const calls: PlannedCall[] = [];
  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;

  for (let step = 0; step < config.maxSteps; step++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools: TOOL_SCHEMAS,
        tool_choice: "auto",
      }),
    });
    if (!res.ok) {
      throw new Error(`LLM HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      choices: Array<{ message: ChatMessage; finish_reason: string }>;
    };
    const msg = data.choices[0]?.message;
    if (!msg) {
      throw new Error("Empty LLM response");
    }
    messages.push(msg);
    if (!msg.tool_calls?.length) {
      break;
    }
    for (const tc of msg.tool_calls) {
      const name = tc.function.name as ToolName;
      const args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
      calls.push({ tool: name, args });
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        name,
        content: JSON.stringify({ acknowledged: true, note: "Execution deferred to runtime" }),
      });
    }
    if (data.choices[0].finish_reason === "stop") {
      break;
    }
  }

  if (calls.length === 0) {
    throw new Error("LLM returned no tool calls");
  }
  return calls;
}

export async function planWithFallback(
  goal: string,
  store: DataStore,
  mode: "mock" | "llm",
  llm?: { baseUrl: string; apiKey: string; model: string; maxSteps: number }
): Promise<{ calls: PlannedCall[]; mode: "mock" | "llm" }> {
  if (mode === "llm" && llm?.apiKey && llm.baseUrl) {
    try {
      const calls = await llmPlan(goal, store, llm);
      return { calls, mode: "llm" };
    } catch {
      return { calls: mockPlan(goal, store), mode: "mock" };
    }
  }
  return { calls: mockPlan(goal, store), mode: "mock" };
}