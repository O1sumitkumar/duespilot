import { useCallback, useEffect, useState } from "react";
import type { AgentRun, ApprovalItem } from "../../shared/types";

const PRESETS = [
  "Recover what's overdue this week",
  "Handle disputed invoice — escalate safely",
  "Draft Hindi/Hinglish reminders for overdue clients",
  "Propose payment plan for clients asking to split payments",
  "Follow up on high-value invoices over ₹50,000",
];

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

  useEffect(() => {
    refreshSummary();
    refreshApprovals();
  }, [refreshApprovals, refreshSummary]);

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
        setRun(JSON.parse(ev.data));
      };
      es.onerror = () => es.close();
      const aud = await fetch(`/api/audit?runId=${data.id}`);
      setAudit(await aud.json());
      await refreshApprovals();
      await refreshSummary();
    } finally {
      setLoading(false);
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    await fetch(`/api/approvals/${id}/${action}`, { method: "POST" });
    await refreshApprovals();
    if (run) {
      const aud = await fetch(`/api/audit?runId=${run.id}`);
      setAudit(await aud.json());
    }
  }

  return (
    <div className="layout">
      <header className="header">
        <div>
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
        <textarea
          id="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
        />
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
        <button type="button" className="primary" onClick={startRun} disabled={loading}>
          {loading ? "Running…" : "Run agent"}
        </button>
      </section>

      <div className="columns">
        <section className="panel">
          <h2>Plan & trace</h2>
          {!run && <p className="muted">Start a run to see live tool calls.</p>}
          {run && (
            <>
              <div className={`status-pill status-${run.status}`}>{run.status}</div>
              <p className="muted small">
                Planner: {run.plannerMode} · {run.steps.length} steps
              </p>
              <ol className="trace">
                {run.steps.map((s) => (
                  <li key={s.index} className={s.blocked ? "blocked" : ""}>
                    <div className="step-head">
                      <strong>{s.tool}</strong>
                      <time>{new Date(s.at).toLocaleTimeString()}</time>
                    </div>
                    <pre className="args">{JSON.stringify(s.args, null, 2)}</pre>
                    <pre className="result">{JSON.stringify(s.result, null, 2)}</pre>
                    {s.blockReason && <p className="warn">{s.blockReason}</p>}
                  </li>
                ))}
              </ol>
              {run.summary && <p className="summary">{run.summary}</p>}
            </>
          )}
        </section>

        <section className="panel">
          <h2>Approval queue</h2>
          {approvals.length === 0 && (
            <p className="muted">No pending actions. Sends always wait here.</p>
          )}
          <ul className="approvals">
            {approvals.map((a) => (
              <li key={a.id}>
                <div className="ap-head">
                  <span className="ap-action">{a.action}</span>
                  <span className="muted">{a.runId.slice(0, 12)}…</span>
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
                <span>{e.message}</span>
                <time>{new Date(e.at).toLocaleString()}</time>
              </li>
            );
          })}
        </ul>
      </section>

      <style>{`
        .layout { max-width: 1240px; margin: 0 auto; padding: 1.25rem 1.5rem 2rem; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
        h1 { margin: 0; font-size: 1.75rem; letter-spacing: -0.02em; }
        h2 { margin: 0 0 0.75rem; font-size: 1.1rem; }
        .tagline { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.95rem; }
        .stats { display: flex; gap: 1rem; color: var(--accent); font-weight: 600; font-size: 0.9rem; }
        .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
        .goal-panel label { display: block; font-weight: 600; margin-bottom: 0.35rem; }
        textarea { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 0.6rem 0.75rem; resize: vertical; }
        .presets { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.65rem 0; }
        .chip { background: var(--surface2); border: 1px solid var(--border); color: var(--muted); padding: 0.35rem 0.6rem; border-radius: 999px; font-size: 0.72rem; max-width: 100%; text-align: left; }
        .chip:hover { border-color: var(--accent); color: var(--text); }
        .primary { background: var(--accent); color: #0a1210; border: none; font-weight: 700; padding: 0.55rem 1.25rem; border-radius: 8px; margin-top: 0.25rem; }
        .primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .columns { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 1rem; }
        @media (max-width: 900px) { .columns { grid-template-columns: 1fr; } }
        .muted { color: var(--muted); }
        .small { font-size: 0.85rem; }
        .status-pill { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem; }
        .status-running { background: #264653; color: var(--accent); }
        .status-awaiting_approval { background: #3d2e1f; color: var(--warn); }
        .status-completed { background: #1e3d2f; color: var(--ok); }
        .status-handed_off { background: #3d2525; color: var(--danger); }
        .status-failed { background: #4a1a1a; color: var(--danger); }
        .trace { list-style: none; padding: 0; margin: 0; max-height: 420px; overflow: auto; }
        .trace li { border: 1px solid var(--border); border-radius: 8px; padding: 0.65rem; margin-bottom: 0.5rem; background: var(--surface2); }
        .trace li.blocked { border-color: var(--warn); }
        .step-head { display: flex; justify-content: space-between; margin-bottom: 0.35rem; }
        pre { margin: 0.25rem 0 0; font-size: 0.72rem; overflow: auto; max-height: 120px; color: #b8c5d6; }
        .args { color: var(--muted); }
        .warn { color: var(--warn); font-size: 0.85rem; margin: 0.35rem 0 0; }
        .summary { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); }
        .approvals { list-style: none; padding: 0; margin: 0; }
        .approvals li { border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; margin-bottom: 0.5rem; background: var(--surface2); }
        .ap-head { display: flex; justify-content: space-between; margin-bottom: 0.35rem; }
        .ap-action { font-weight: 700; color: var(--warn); text-transform: uppercase; font-size: 0.75rem; }
        .ap-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
        .ok { background: var(--ok); border: none; color: #0d1f14; padding: 0.4rem 0.9rem; border-radius: 6px; font-weight: 600; }
        .danger { background: transparent; border: 1px solid var(--danger); color: var(--danger); padding: 0.4rem 0.9rem; border-radius: 6px; font-weight: 600; }
        .audit { list-style: none; padding: 0; margin: 0; max-height: 200px; overflow: auto; font-size: 0.8rem; }
        .audit li { display: grid; grid-template-columns: 90px 100px 1fr auto; gap: 0.5rem; padding: 0.35rem 0; border-bottom: 1px solid var(--border); align-items: center; }
        .audit-type { color: var(--accent); font-weight: 600; text-transform: uppercase; font-size: 0.7rem; }
        .audit code { color: var(--muted); }
        .audit time { color: var(--muted); font-size: 0.7rem; }
      `}</style>
    </div>
  );
}