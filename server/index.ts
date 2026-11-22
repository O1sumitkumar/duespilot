import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent } from "./agent/runner.js";
import { loadStore, resetStore, saveStore } from "./data/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 43123;
const PLANNER_MODE = (process.env.PLANNER_MODE === "llm" ? "llm" : "mock") as "mock" | "llm";

const app = express();
app.use(express.json());

const sseClients = new Map<string, express.Response>();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, planner: PLANNER_MODE });
});

app.get("/api/store/summary", (_req, res) => {
  const store = loadStore();
  res.json({
    clients: store.clients.length,
    invoices: store.invoices.length,
    overdue: store.invoices.filter((i) => i.status === "overdue").length,
    pendingApprovals: store.approvals.filter((a) => a.status === "pending").length,
  });
});

app.get("/api/runs", (_req, res) => {
  const store = loadStore();
  res.json(store.runs.slice().reverse());
});

app.get("/api/runs/:id", (req, res) => {
  const store = loadStore();
  const run = store.runs.find((r) => r.id === req.params.id);
  if (!run) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(run);
});

app.get("/api/runs/:id/stream", (req, res) => {
  const runId = req.params.id;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  sseClients.set(runId, res);
  req.on("close", () => sseClients.delete(runId));
});

function emitRun(runId: string, run: unknown): void {
  const client = sseClients.get(runId);
  if (client) {
    client.write(`data: ${JSON.stringify(run)}\n\n`);
  }
}

app.post("/api/runs", async (req, res) => {
  const goal = String(req.body?.goal ?? "").trim();
  if (!goal) {
    res.status(400).json({ error: "goal_required" });
    return;
  }
  const store = loadStore();
  const run = await runAgent(store, goal, {
    plannerMode: PLANNER_MODE,
    llmBaseUrl: process.env.LLM_BASE_URL,
    llmApiKey: process.env.LLM_API_KEY,
    llmModel: process.env.LLM_MODEL,
    onStep: (r) => emitRun(r.id, r),
  });
  emitRun(run.id, run);
  res.json(run);
});

app.get("/api/approvals", (_req, res) => {
  const store = loadStore();
  res.json(store.approvals.filter((a) => a.status === "pending"));
});

app.post("/api/approvals/:id/approve", (req, res) => {
  const store = loadStore();
  const item = store.approvals.find((a) => a.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  item.status = "approved";
  store.audits.push({
    id: `aud_${Date.now()}`,
    runId: item.runId,
    at: new Date().toISOString(),
    type: "approval",
    message: `Approved ${item.action}`,
    result: item,
  });
  if (item.action === "mark_written_off") {
    const invId = item.payload.invoiceId as string;
    const inv = store.invoices.find((i) => i.id === invId);
    if (inv) inv.status = "written_off";
  }
  const run = store.runs.find((r) => r.id === item.runId);
  if (run && run.status === "awaiting_approval") {
    const still = store.approvals.filter(
      (a) => a.runId === item.runId && a.status === "pending"
    );
    if (still.length === 0) {
      run.status = "completed";
    }
  }
  saveStore(store);
  res.json(item);
});

app.post("/api/approvals/:id/reject", (req, res) => {
  const store = loadStore();
  const item = store.approvals.find((a) => a.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  item.status = "rejected";
  store.audits.push({
    id: `aud_${Date.now()}`,
    runId: item.runId,
    at: new Date().toISOString(),
    type: "approval",
    message: `Rejected ${item.action}`,
    result: item,
  });
  saveStore(store);
  res.json(item);
});

app.get("/api/audit", (req, res) => {
  const store = loadStore();
  const runId = req.query.runId as string | undefined;
  let logs = store.audits;
  if (runId) logs = logs.filter((a) => a.runId === runId);
  res.json(logs.slice(-200).reverse());
});

const clientDistCandidates = [
  path.resolve(__dirname, "../client"),
  path.resolve(__dirname, "../dist/client"),
];
const clientDist =
  clientDistCandidates.find((dir) =>
    fs.existsSync(path.join(dir, "index.html"))
  ) ?? clientDistCandidates[0];
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (_req, res, next) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

if (process.env.SEED_ON_START === "1") {
  resetStore();
}

app.listen(PORT, () => {
  console.log(`DuesPilot listening on http://127.0.0.1:${PORT}`);
});