import type { CalendarEvent, ToolContext } from "../../shared/types.js";
import { newId } from "../data/store.js";

const CHANNELS = new Set(["email", "whatsapp", "call"]);

export function scheduleFollowup(ctx: ToolContext, args: Record<string, unknown>) {
  const clientId = args.clientId as string;
  const title = args.title as string;
  const at = args.at as string;
  const invoiceId = typeof args.invoiceId === "string" ? args.invoiceId : undefined;
  const inv = invoiceId ? ctx.store.invoices.find((i) => i.id === invoiceId) : undefined;
  const channel = (
    typeof args.channel === "string" && CHANNELS.has(args.channel) ? args.channel : "email"
  ) as CalendarEvent["channel"];
  const client = ctx.store.clients.find((c) => c.id === clientId);
  const ev: CalendarEvent = {
    id: newId("ev"),
    clientId,
    title,
    at,
    type: "followup",
    channel,
    ...(invoiceId ? { invoiceId } : {}),
    ...(inv ? { invoiceNumber: inv.number } : {}),
  };
  ctx.store.calendar.push(ev);
  return {
    scheduled: ev,
    clientName: client?.name,
    note: "Calendar event saved (not synced externally)",
  };
}
