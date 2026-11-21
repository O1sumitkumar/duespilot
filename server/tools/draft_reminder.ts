import type { ToolContext } from "../../shared/types.js";

const TEMPLATES: Record<string, Record<string, string>> = {
  en: {
    professional:
      "Dear {{name}},\n\nThis is a courteous reminder that invoice {{inv}} for ₹{{amount}} (due {{due}}) remains outstanding. Please let us know if you need any clarification.\n\nThank you,\nDuesPilot Collections",
    warm:
      "Hi {{name}}, hope you're doing well! Just a friendly nudge on invoice {{inv}} (₹{{amount}}, due {{due}}). Happy to help if anything's blocking payment.\n\nBest,\nTeam",
    firm:
      "Dear {{name}},\n\nInvoice {{inv}} for ₹{{amount}} is overdue since {{due}}. Please arrange payment within 5 business days or reply with your proposed timeline.\n\nRegards,\nAccounts",
  },
  hi: {
    professional:
      "प्रिय {{name}},\n\nयह सूचित करने के लिए कि चालान {{inv}} की राशि ₹{{amount}} (अंतिम तिथि {{due}}) अभी तक जमा नहीं हुई है। कृपया भुगतान करें या हमें सूचित करें।\n\nधन्यवाद",
    warm:
      "नमस्ते {{name}}, उम्मीद है सब ठीक होगा। चालान {{inv}} (₹{{amount}}) का भुगतान करने में कोई दिक्कत हो तो बताइए।",
    firm:
      "महोदय {{name}}, चालान {{inv}} पर ₹{{amount}} की देय राशि {{due}} से अतिदेय है। कृपया शीघ्र भुगतान करें।",
  },
  hinglish: {
    professional:
      "Hi {{name}},\n\nQuick reminder — invoice {{inv}} ka ₹{{amount}} balance {{due}} se pending hai. Payment update share kar dijiye.\n\nThanks!",
    warm:
      "Hey {{name}}, bas ek polite reminder for {{inv}} (₹{{amount}}). Agar koi issue hai toh batao, saath mein sort karte hain.",
    firm:
      "{{name}}, invoice {{inv}} overdue hai (₹{{amount}}, due {{due}}). Please 5 working days mein clear karne ka plan share karein.",
  },
};

export function draftReminder(ctx: ToolContext, args: Record<string, unknown>) {
  const invoiceId = args.invoiceId as string;
  const lang = (args.lang as string) || "en";
  const tone = (args.tone as string) || "professional";
  const inv = ctx.store.invoices.find((i) => i.id === invoiceId);
  if (!inv) {
    return { error: "invoice_not_found", invoiceId };
  }
  const client = ctx.store.clients.find((c) => c.id === inv.clientId);
  const tpl =
    TEMPLATES[lang]?.[tone] ?? TEMPLATES.en.professional;
  const balance = inv.amountInr - inv.paidInr;
  const body = tpl
    .replaceAll("{{name}}", client?.name ?? "Client")
    .replaceAll("{{inv}}", inv.number)
    .replaceAll("{{amount}}", balance.toLocaleString("en-IN"))
    .replaceAll("{{due}}", inv.dueAt);
  return {
    invoiceId,
    clientId: inv.clientId,
    lang,
    tone,
    subject: `Payment reminder: ${inv.number}`,
    body,
    balanceInr: balance,
  };
}