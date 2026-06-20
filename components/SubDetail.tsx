"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney, dueLabel } from "./format";

interface Sub {
  id: string; name: string; category: string; amount: number | null; currency: string;
  cycle: string; monthly: number; status: string; source: string; confidence: number;
  protected: boolean; isTrial: boolean; nextDueAt: string | null;
  previousAmount: number | null; priceChangedAt: string | null; cancelUrl: string | null;
  notes: string | null; knownPlaybook: boolean;
}
interface Charge { date: string; amount: number; source: string; description: string | null }
interface Action { type: string; status: string; detail: string | null; createdAt: string }

/* deterministic colour from name */
const AVATAR_COLORS = [
  "bg-accent", "bg-data-blue", "bg-success", "bg-warning", "bg-error",
  "bg-data-violet", "bg-data-teal", "bg-data-coral", "bg-accent-soft", "bg-data-blue",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function dotColor(status: string) {
  if (status === "success") return "bg-success";
  if (status === "failed") return "bg-error";
  if (status === "dry_run") return "bg-accent";
  return "bg-warning";
}

export default function SubDetail({ sub, charges, actions }: { sub: Sub; charges: Charge[]; actions: Action[] }) {
  const router = useRouter();
  const [plan, setPlan] = useState<string | null>(null);
  const [retention, setRetention] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function loadPlan() {
    setBusy(true);
    const res = await fetch(`/api/subscriptions/${sub.id}/plan`);
    const data = await res.json();
    const p = data.plan;
    setPlan(
      p
        ? `Method: ${p.method} · Source: ${p.source}${data.hasMacro ? ` · 🤖 recorded macro (${data.macroSteps} steps)` : ""}\n${p.cancelUrl ? "URL: " + p.cancelUrl + "\n" : ""}${p.phone ? "Phone: " + p.phone + "\n" : ""}Steps:\n- ${p.steps.join("\n- ")}${p.retentionTip ? "\n\n💡 " + p.retentionTip : ""}\n\n${data.blockGuidance}`
        : "No plan.",
    );
    setBusy(false);
  }

  async function saveMacro() {
    const raw = prompt(
      `Paste cancel-macro steps as JSON for ${sub.name}.\nGenerate with: npx playwright codegen <cancel-url>\nExample:\n[{"action":"goto","url":"https://..."},{"action":"click","selector":"text=Cancel"}]`,
    );
    if (!raw) return;
    let steps: unknown;
    try { steps = JSON.parse(raw); } catch { setToast("Not valid JSON"); return; }
    setBusy(true);
    const res = await fetch("/api/macros", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ merchant: sub.name, steps }) });
    const data = await res.json();
    setToast(data.message || "Saved");
    setBusy(false);
    setTimeout(() => setToast(null), 6000);
  }

  async function loadRetention() {
    setBusy(true);
    const res = await fetch(`/api/subscriptions/${sub.id}/retention`);
    const data = await res.json();
    const d = data.draft;
    setRetention(d ? `Strategy: ${d.strategy}\nWhy: ${d.rationale}\n\nSubject: ${d.subject}\n\n${d.body}` : "No draft.");
    setBusy(false);
  }

  async function action(url: string, body: unknown) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setToast(data.message || "Done");
    setBusy(false);
    router.refresh();
    setTimeout(() => setToast(null), 6000);
  }

  const priceDelta = sub.previousAmount != null && sub.amount != null ? sub.amount - sub.previousAmount : null;

  return (
    <div className="space-y-6 animate-stagger">
      {/* ── Hero Card ──────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-start gap-4">
          {/* Large avatar initial */}
          <div
            className={`avatar-initial ${avatarColor(sub.name)} text-white`}
            style={{ width: 56, height: 56, fontSize: "1.25rem", borderRadius: "1rem" }}
          >
            {sub.name.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-semibold text-ink truncate">{sub.name}</h1>
              {sub.isTrial && <span className="pill bg-data-coral-soft text-on-data-coral">trial</span>}
              {sub.knownPlaybook && <span className="pill bg-success-soft text-on-success">playbook</span>}
            </div>
            <p className="mt-0.5 text-sm text-ink-2">
              {sub.category} · {sub.source} · {Math.round(sub.confidence * 100)}% confidence
            </p>
          </div>
        </div>

        {/* ── Stats row ────────────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="stat-tile text-center">
            <div className="stat-label">Amount</div>
            <div className="stat-value font-sans text-2xl text-ink">{fmtMoney(sub.amount)}</div>
          </div>
          <div className="stat-tile text-center">
            <div className="stat-label">Cycle</div>
            <div className="stat-value font-sans text-2xl text-ink">{sub.cycle}</div>
          </div>
          <div className="stat-tile text-center">
            <div className="stat-label">Next due</div>
            <div className="stat-value font-sans text-2xl text-ink">{dueLabel(sub.nextDueAt)}</div>
          </div>
          <div className="stat-tile text-center">
            <div className="stat-label">Source</div>
            <div className="stat-value font-sans text-2xl text-ink capitalize">{sub.source}</div>
          </div>
        </div>

        {/* ── Price change alert ────────────────────────────────────── */}
        {priceDelta != null && Math.abs(priceDelta) > 0.01 && (
          <div
            className={`mt-4 rounded-lg border-l-4 px-4 py-3 text-sm ${
              priceDelta > 0 ? "border-error bg-error-soft text-on-error" : "border-success bg-success-soft text-on-success"
            }`}
          >
            Price {priceDelta > 0 ? "increased" : "decreased"} {fmtMoney(Math.abs(priceDelta))} (was {fmtMoney(sub.previousAmount)})
            {sub.priceChangedAt && ` on ${new Date(sub.priceChangedAt).toLocaleDateString()}`}
          </div>
        )}

        {/* ── Action buttons ───────────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className="btn-danger"
            onClick={() => action("/api/cancel", { id: sub.id })}
            disabled={busy || sub.protected || sub.status !== "active"}
          >
            Cancel now
          </button>
          <button
            className="btn-primary"
            onClick={() => action("/api/cancel", { id: sub.id, dryRun: true })}
            disabled={busy}
          >
            Dry-run cancel
          </button>
          <button className="btn-ghost" onClick={loadPlan} disabled={busy}>Preview cancel plan</button>
          <button className="btn-ghost" onClick={saveMacro} disabled={busy}>🤖 Record cancel macro</button>
          <button className="btn-ghost" onClick={loadRetention} disabled={busy}>💰 Draft retention offer</button>
          <button
            className="btn-ghost"
            onClick={() => action(`/api/subscriptions/${sub.id}/retention`, {})}
            disabled={busy}
          >
            Save retention draft to mailbox
          </button>
          <button
            className="btn-ghost"
            onClick={() => action(`/api/subscriptions/${sub.id}`, { protected: !sub.protected })}
            disabled={busy}
          >
            {sub.protected ? "🔒 Protected" : "🔓 Protect"}
          </button>
        </div>

        {/* ── Cancel plan preview ──────────────────────────────────── */}
        {plan && (
          <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-line bg-sunken p-4 text-xs text-ink-2 leading-relaxed">
            {plan}
          </pre>
        )}

        {/* ── Retention draft ──────────────────────────────────────── */}
        {retention && (
          <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-success/20 bg-sunken p-4 text-xs text-ink-2 leading-relaxed">
            {retention}
          </pre>
        )}
      </div>

      {/* ── History panels ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Charge history */}
        <div className="card">
          <h2 className="stat-label mb-4">
            💳 Charge history <span className="text-ink">({charges.length})</span>
          </h2>
          {charges.length === 0 ? (
            <p className="text-sm text-ink-3">No charges recorded yet.</p>
          ) : (
            <div className="relative ml-3 border-l-2 border-line pl-5 space-y-4">
              {charges.map((c, i) => (
                <div key={i} className="relative">
                  {/* dot */}
                  <span className="absolute -left-[1.625rem] top-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink num">{fmtMoney(c.amount)}</span>
                    <span className="text-xs text-ink-3 whitespace-nowrap">
                      {new Date(c.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-ink-3 mt-0.5">{c.source}{c.description ? ` · ${c.description}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action history */}
        <div className="card">
          <h2 className="stat-label mb-4">
            ⚡ Action history <span className="text-ink">({actions.length})</span>
          </h2>
          {actions.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing yet.</p>
          ) : (
            <div className="relative ml-3 border-l-2 border-line pl-5 space-y-4">
              {actions.map((a, i) => (
                <div key={i} className="relative">
                  {/* status dot */}
                  <span className={`absolute -left-[1.625rem] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${dotColor(a.status)}`} />
                  <div className="flex items-center gap-2">
                    <span className="pill bg-sunken text-ink-3">{a.type}</span>
                    <span className={`text-sm font-medium ${
                      a.status === "success" ? "text-success" : a.status === "failed" ? "text-error" : "text-ink-3"
                    }`}>
                      {a.status}
                    </span>
                  </div>
                  <p className="text-xs text-ink-3 mt-0.5">{new Date(a.createdAt).toLocaleString()}</p>
                  {a.detail && <p className="text-xs text-ink-3/70 mt-0.5">{a.detail}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 bg-accent rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-accent/20">
          {toast}
        </div>
      )}
    </div>
  );
}
