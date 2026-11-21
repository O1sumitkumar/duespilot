import type { ToolContext } from "../../shared/types.js";

export function readThread(ctx: ToolContext, args: Record<string, unknown>) {
  const clientId = args.clientId as string;
  const threadId = args.threadId as string | undefined;
  const threads = ctx.store.threads.filter((t) => t.clientId === clientId);
  if (threads.length === 0) {
    return { messages: [], riskFlags: [] as string[] };
  }
  const thread = threadId
    ? threads.find((t) => t.id === threadId) ?? threads[0]
    : threads[0];
  const riskFlags: string[] = [];
  for (const m of thread.messages) {
    if (m.sentiment === "angry") riskFlags.push("angry_thread");
    if (m.sentiment === "dispute") riskFlags.push("dispute_thread");
  }
  return {
    threadId: thread.id,
    invoiceIds: thread.invoiceIds,
    messages: thread.messages,
    riskFlags: [...new Set(riskFlags)],
  };
}