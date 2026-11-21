import type { ToolContext } from "../../shared/types.js";
import { newId } from "../data/store.js";

export function scheduleFollowup(ctx: ToolContext, args: Record<string, unknown>) {
  const clientId = args.clientId as string;
  const title = args.title as string;
  const at = args.at as string;
  const ev = {
    id: newId("ev"),
    clientId,
    title,
    at,
    type: "followup" as const,
  };
  ctx.store.calendar.push(ev);
  return { scheduled: ev, note: "Calendar event saved (not synced externally)" };
}