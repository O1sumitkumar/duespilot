import { useCallback, useEffect, useState } from "react";
import type { AgentRun, ApprovalItem, RunStep } from "../../shared/types";
import {
  approvalActionLabel,
  draftBodyFromStep,
  runStatusLabel,
  summarizeStep,
} from "./stepUi";

const PRESETS = [
  "Recover what's overdue this week",
  "Handle disputed invoice — escalate safely",
  "Draft Hindi/Hinglish reminders for overdue clients",
  "Propose payment plan for clients asking to split payments",
  "Follow up on high-value invoices over ₹50,000",
];

function TraceStep({ step }: { step: RunStep }) {
  const [showJson, setShowJson] = useState(false);
  const draftBody = draftBodyFromStep(step);

  return (
    <li className={step.blocked ? "blocked" : ""}>
      <div className="step-head">
        <strong>{step.tool}</strong>
        <time>{new Date(step.at).toLocaleTimeString()}</time>
      </div>
      <p className="step-summary">{summarizeStep(step)}</p>
      {draftBody && (
        <div className="draft-card" role="region" aria-label="Draft reminder text">
          <span className="draft-label">Draft message</span>
          <pre className="draft-body">{draftBody}</pre>
        </div>
      )}
      {step.blockReason && <p className="warn">{step.blockReason}</p>}
      <button
        type="button"
        className="json-toggle"
        onClick={() => setShowJson((v) => !v)}
        aria-expanded={showJson}
      >
        {showJson ? "Hide JSON" : "Show JSON"}
      </button>
      {showJson && (
        <div className="json-block">
          <div className="json-section">
            <span className="json-label">Args</span>
            <pre className="json-pre">{JSON.stringify(step.args, null, 2)}</pre>
          </div>
          <div className="json-section">
            <span className="json-label">Result</span>
            <pre className="json-pre">{JSON.stringify(step.result, null, 2)}</pre>
          </div>
        </div>
      )}
    </li>
  );
}

export default function App() {
  const [goal, setGoal] = useState(PRESETS[0]);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [audit, setAudit] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{
    clients: number;
    overdue: number;
    pendingApprovals: number;
  } | null>(null);

  const refreshApprovals = useCallback(async () => {
    const res = await fetch("/api/approvals");
    setApprovals(await res.json());
  }, []);

  const refreshSummary = useCallback(async () => {
    const res = await fetch("/api/store/summary");
    setSummary(await res.json());
  }, []);

  const refreshHeaderStats = useCallback(async () => {
    await Promise.all([refreshSummary(), refreshApprovals()]);
  }, [refreshApprovals, refreshSummary]);

  useEffect(() => {
    refreshHeaderStats();
  }, [refreshHeaderStats]);

  async function startRun() {
    setLoading(true);
    setRun(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const data: AgentRun = await res.json();
      setRun(data);
      const es = new EventSource(`/api/runs/${data.id}/stream`);
      es.onmessage = (ev) => {
        const next = JSON.parse(ev.data) as AgentRun;
        setRun(next);
        if (
          next.status !== "running" &&
          next.endedAt
        ) {
          void refreshHeaderStats();
        }
      };
      es.onerror = () => es.close();
      const aud = await fetch(`/api/audit?runId=${data.id}`);
      setAudit(await aud.json());
      await refreshHeaderStats();
    } finally {
      setLoading(false);
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    await fetch(`/api/approvals/${id}/${action}`, { method: "POST" });
    await refreshHeaderStats();
    if (run) {
      const aud = await fetch(`/api/audit?runId=${run.id}`);
      setAudit(await aud.json());
    }
  }

  return (
    <div className="layout">
      <header className="header">
        <div className="brand">
          <h1>DuesPilot</h1>
          <p className="tagline">Autonomous collections-ops for Indian freelancers</p>
        </div>
        {summary && (
          <div className="stats">
            <span>{summary.overdue} overdue</span>
            <span>{summary.pendingApprovals} pending approvals</span>
          </div>
        )}
      </header>

      <section className="panel goal-panel">
        <label htmlFor="goal">Agent goal</label>
        <div className="goal-row">
          <textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={1}
          />
          <button type="button" className="primary" onClick={startRun} disabled={loading}>
            {loading ? "Running…" : "Run agent"}
          </button>
        </div>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className="chip"
              onClick={() => setGoal(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      <div className="columns">
        <section className="panel trace-panel">
          <h2>Plan & trace</h2>
          {!run && <p className="muted">Start a run to see live tool calls.</p>}
          {run && (
            <>
              <div className="run-meta">
                <span
                  className={`status-pill status-${run.status}`}
                  data-status={run.status}
                  title={run.status}
                >
                  {runStatusLabel(run.status)}
                </span>
                <span className="muted small">
                  Planner: {run.plannerMode} · {run.steps.length} steps
                </span>
              </div>
              <ol className="trace">
                {run.steps.map((s) => (
                  <TraceStep key={s.index} step={s} />
                ))}
              </ol>
              {run.summary && <p className="summary">{run.summary}</p>}
            </>
          )}
        </section>

        <section className="panel approval-panel">
          <h2>Approval queue</h2>
          {approvals.length === 0 && (
            <p className="muted">No pending actions. Sends always wait here.</p>
          )}
          <ul className="approvals">
            {approvals.map((a) => (
              <li key={a.id}>
                <div className="ap-head">
                  <span className="ap-action" title={a.action}>{approvalActionLabel(a.action)}</span>
                  <span className="muted small" title={a.runId}>{new Date(a.createdAt).toLocaleTimeString()}</span>
                </div>
                <p>{a.summary}</p>
                <div className="ap-actions">
                  <button type="button" className="ok" onClick={() => decide(a.id, "approve")}>
                    Approve
                  </button>
                  <button type="button" className="danger" onClick={() => decide(a.id, "reject")}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel audit-panel">
        <h2>Audit log</h2>
        <ul className="audit">
          {audit.slice(0, 30).map((entry) => {
            const e = entry as { id: string; type: string; at: string; message?: string; tool?: string };
            return (
              <li key={e.id}>
                <span className="audit-type">{e.type}</span>
                {e.tool && <code>{e.tool}</code>}
                <span className="audit-msg">
                  {e.type === "run_end" && e.message ? runStatusLabel(e.message) : e.message}
                </span>
                <time>{new Date(e.at).toLocaleString()}</time>
              </li>
            );
          })}
        </ul>
      </section>

      <style>{`
        .layout {
          max-width: 1240px;
          width: 100%;
          margin: 0 auto;
          padding: 0.75rem 1.5rem 1.5rem;
          overflow-x: clip;
        }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.75rem; }
        .brand { display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; }
        h1 { margin: 0; font-size: 1.45rem; letter-spacing: -0.02em; }
        h2 { margin: 0 0 0.75rem; font-size: 1.1rem; }
        .tagline { margin: 0; color: var(--muted); font-size: 0.95rem; }
        .stats { display: flex; gap: 1rem; color: var(--accent); font-weight: 600; font-size: 0.9rem; flex-wrap: wrap; }
        .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 0.75rem; min-width: 0; }
        .goal-row { display: flex; gap: 0.6rem; align-items: stretch; }
        .goal-row textarea { flex: 1; min-width: 0; }
        .goal-row .primary { margin-top: 0; white-space: nowrap; }
        .run-meta { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
        .goal-panel label { display: block; font-weight: 600; margin-bottom: 0.35rem; }
        textarea { width: 100%; max-width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 0.6rem 0.75rem; resize: vertical; }
        .presets { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.5rem 0 0; }
        .chip { background: var(--surface2); border: 1px solid var(--border); color: var(--muted); padding: 0.35rem 0.6rem; border-radius: 999px; font-size: 0.72rem; max-width: 100%; text-align: left; }
        .chip:hover { border-color: var(--accent); color: var(--text); }
        .primary { background: var(--accent); color: #0a1210; border: none; font-weight: 700; padding: 0.55rem 1.25rem; border-radius: 8px; margin-top: 0.25rem; }
        .primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .columns { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); gap: 0.75rem; align-items: start; }
        /* Keep the approval queue fully on-screen while the trace scrolls (fits 1280x800). */
        .approval-panel { position: sticky; top: 0.5rem; max-height: calc(100vh - 1rem); overflow-y: auto; }
        .approval-panel h2 { position: sticky; top: -0.75rem; background: var(--surface); padding: 0.25rem 0; margin-top: -0.25rem; z-index: 1; }
        @media (max-width: 900px) { .columns { grid-template-columns: minmax(0, 1fr); } .approval-panel { position: static; max-height: none; } }
        .muted { color: var(--muted); }
        .small { font-size: 0.85rem; }
        .status-pill { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 700; }
        .status-running { background: #264653; color: var(--accent); }
        .status-awaiting_approval { background: #3d2e1f; color: var(--warn); }
        .status-completed { background: #1e3d2f; color: var(--ok); }
        .status-handed_off { background: #3d2525; color: var(--danger); }
        .status-failed { background: #4a1a1a; color: var(--danger); }
        .trace { list-style: none; padding: 0; margin: 0; }
        .trace li { border: 1px solid var(--border); border-radius: 8px; padding: 0.65rem; margin-bottom: 0.5rem; background: var(--surface2); min-width: 0; }
        .trace li.blocked { border-color: var(--warn); }
        .step-head { display: flex; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.35rem; flex-wrap: wrap; }
        .step-summary { margin: 0 0 0.35rem; font-size: 0.88rem; color: var(--text); word-break: break-word; }
        .draft-card { margin: 0.5rem 0; padding: 0.65rem 0.75rem; border-radius: 8px; border: 1px solid var(--accent-dim); background: #15241f; min-width: 0; }
        .draft-label { display: block; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: var(--accent); margin-bottom: 0.35rem; }
        .draft-body { margin: 0; font-size: 0.82rem; line-height: 1.45; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; color: var(--text); font-family: inherit; }
        .json-toggle { background: transparent; border: 1px solid var(--border); color: var(--muted); font-size: 0.72rem; padding: 0.25rem 0.55rem; border-radius: 6px; margin-top: 0.25rem; }
        .json-toggle:hover { border-color: var(--accent); color: var(--text); }
        .json-block { margin-top: 0.5rem; min-width: 0; }
        .json-section { margin-bottom: 0.35rem; }
        .json-label { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; }
        .json-pre { margin: 0.2rem 0 0; font-size: 0.72rem; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; color: #b8c5d6; max-width: 100%; }
        .warn { color: var(--warn); font-size: 0.85rem; margin: 0.35rem 0 0; }
        .summary { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); word-break: break-word; }
        .approvals { list-style: none; padding: 0; margin: 0; }
        .approvals li { border: 1px solid var(--border); border-radius: 8px; padding: 0.55rem 0.7rem; margin-bottom: 0.45rem; font-size: 0.88rem; background: var(--surface2); min-width: 0; word-break: break-word; }
        .ap-head { display: flex; justify-content: space-between; margin-bottom: 0.35rem; gap: 0.5rem; flex-wrap: wrap; }
        .ap-action { font-weight: 700; color: var(--warn); font-size: 0.8rem; }
        .approvals li p { margin: 0.2rem 0; }
        .ap-actions { display: flex; gap: 0.5rem; margin-top: 0.35rem; flex-wrap: wrap; }
        .ok { background: var(--ok); border: none; color: #0d1f14; padding: 0.4rem 0.9rem; border-radius: 6px; font-weight: 600; }
        .danger { background: transparent; border: 1px solid var(--danger); color: var(--danger); padding: 0.4rem 0.9rem; border-radius: 6px; font-weight: 600; }
        .audit { list-style: none; padding: 0; margin: 0; font-size: 0.8rem; }
        .audit li { display: grid; grid-template-columns: minmax(70px, 90px) minmax(60px, 100px) minmax(0, 1fr) auto; gap: 0.5rem; padding: 0.35rem 0; border-bottom: 1px solid var(--border); align-items: center; }
        .audit-type { color: var(--accent); font-weight: 600; text-transform: uppercase; font-size: 0.7rem; }
        .audit code { color: var(--muted); }
        .audit-msg { min-width: 0; word-break: break-word; }
        .audit time { color: var(--muted); font-size: 0.7rem; white-space: nowrap; }
      `}</style>
    </div>
  );
}