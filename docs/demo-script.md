# DuesPilot — 3-minute demo script

**Audience:** Hackathon judges (Agents track)

## 0:00 — Problem (20s)

Open the app. Say: Indian freelancers lose hours chasing overdue invoices. DuesPilot is an autonomous collections-ops agent on a **synthetic** dataset — it plans, calls tools, drafts English/Hindi/Hinglish reminders, and **never sends** without human approval.

## 0:20 — Default collections run (50s)

1. Leave the preset goal: **"Recover what's overdue this week"**.
2. Click **Run agent**.
3. Point at the **Plan & trace** panel: `list_invoices` → `read_thread` → `draft_reminder` → `schedule_followup` → `queue_send`.
4. Highlight status **awaiting_approval** and the audit types (`tool_call`, `guardrail`, `planner`).

## 1:10 — Safety: approval queue (45s)

1. Open **Approval queue** — each `queue_send` shows client, invoice, amount.
2. Click **Approve** on one item (simulates human send authorization).
3. Mention: amounts **> ₹50,000** always land here; nothing is marked "sent" in the tool layer.

## 1:55 — Dispute / angry thread (40s)

1. Pick preset **"Handle disputed invoice — escalate safely"**.
2. Run again — show `read_thread` risk, blocked collection, **`escalate`** and status **handed_off**.

## 2:35 — Hindi / Hinglish (25s)

1. Run **"Draft Hindi/Hinglish reminders for overdue clients"**.
2. Expand a `draft_reminder` result — show Hindi or Hinglish copy.

## 2:55 — Close (5s)

Optional: `npm run eval` for the scorecard. Built with mock planner by default; optional OpenAI-compatible LLM via `.env`.

**Total: ~3 minutes**