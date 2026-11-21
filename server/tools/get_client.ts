import type { ToolContext } from "../../shared/types.js";

export function getClient(ctx: ToolContext, args: Record<string, unknown>) {
  const clientId = args.clientId as string;
  const client = ctx.store.clients.find((c) => c.id === clientId);
  if (!client) {
    return { error: "client_not_found", clientId };
  }
  return client;
}