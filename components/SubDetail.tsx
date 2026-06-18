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

export default function SubDetail({ sub, charges, actions }: { sub: Sub; charges: Charge[]; actions: Action[] }) {
  const router = useRouter();
  const [plan, setPlan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function loadPlan() {
    setBusy(true);
    const res = await fetch(`/api/subscriptions/${sub.id}/plan`);
    const data = await res.json();
    const p = data.plan;
    setPlan(
      p
        ? `Method: ${p.method} · Source: ${p.source}\n${p.cancelUrl ? "URL: " + p.cancelUrl + "\n" : ""}${p.phone ? "Phone: " + p.phone + "\n" : ""}Steps:\n- ${p.steps.join("\n- ")}${p.retentionTip ? "\n\n💡 " + p.retentionTip : ""}`
        : "No plan.",
    );
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
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {sub.name} {sub.isTrial && <span className="pill bg-bad/20 text-bad">trial</span>}
              {sub.knownPlaybook && <span className="pill bg-good/20 text-good ml-1">playbook</span>}
            </h1>
            <p className="text-sm text-muted">{sub.category} · {sub.source} · {Math.round(sub.confidence * 100)}% confidence</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{fmtMoney(sub.amount)}</div>
            <div className="text-sm text-muted">{fmtMoney(sub.monthly)}/mo · next {dueLabel(sub.nextDueAt)}</div>
          </div>
        </div>

        {priceDelta != null && Math.abs(priceDelta) > 0.01 && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${priceDelta > 0 ? "border-bad/40 bg-bad/10 text-bad" : "border-good/40 bg-good/10 text-good"}`}>
            Price {priceDelta > 0 ? "increased" : "decreased"} {fmtMoney(Math.abs(priceDelta))} (was {fmtMoney(sub.previousAmount)})
            {sub.priceChangedAt && ` on ${new Date(sub.priceChangedAt).toLocaleDateString()}`}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={loadPlan} disabled={busy}>Preview cancel plan</button>
          <button className="btn-ghost" onClick={() => action(`/api/subscriptions/${sub.id}`, { protected: !sub.protected })} disabled={busy}>
            {sub.protected ? "🔒 Protected" : "🔓 Protect"}
          </button>
          <button className="btn-ghost" onClick={() => action("/api/cancel", { id: sub.id, dryRun: true })} disabled={busy}>Dry-run cancel</button>
          <button className="btn-danger" onClick={() => action("/api/cancel", { id: sub.id })} disabled={busy || sub.protected || sub.status !== "active"}>Cancel now</button>
        </div>
        {plan && <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-edge bg-ink p-3 text-xs text-muted">{plan}</pre>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Charge history ({charges.length})</h2>
          {charges.length === 0 ? (
            <p className="text-sm text-muted">No charges recorded yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {charges.map((c, i) => (
                <li key={i} className="flex justify-between border-b border-edge/40 py-1">
                  <span className="text-muted">{new Date(c.date).toLocaleDateString()} · {c.source}</span>
                  <span>{fmtMoney(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Action history ({actions.length})</h2>
          {actions.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {actions.map((a, i) => (
                <li key={i} className="border-b border-edge/40 py-1">
                  <span className="pill bg-edge text-muted mr-2">{a.type}</span>
                  <span className={a.status === "success" ? "text-good" : a.status === "failed" ? "text-bad" : "text-muted"}>{a.status}</span>
                  <span className="text-muted"> · {new Date(a.createdAt).toLocaleString()}</span>
                  {a.detail && <div className="text-xs text-muted">{a.detail}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg border border-edge bg-panel px-4 py-2 text-sm shadow-lg">{toast}</div>}
    </div>
  );
}
