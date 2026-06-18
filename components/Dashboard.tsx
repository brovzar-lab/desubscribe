"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Insight } from "@/lib/insights";
import CategoryChart from "./CategoryChart";
import { monthlyEq, fmtMoney, cycleLabel, dueLabel } from "./format";

export interface ClientSub {
  id: string;
  name: string;
  category: string;
  amount: number | null;
  currency: string;
  cycle: string;
  status: string;
  source: string;
  confidence: number;
  protected: boolean;
  isTrial: boolean;
  nextDueAt: string | null;
  lastChargeAt: string | null;
  hasUnsub: boolean;
  cancelUrl: string | null;
}

interface Props {
  subs: ClientSub[];
  totals: { monthly: number; yearly: number; count: number };
  insights: Insight[];
  byCategory: { category: string; monthly: number }[];
  automationLevel: string;
  killSwitch: boolean;
  demoMode: boolean;
}

export default function Dashboard(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function post(url: string, body: unknown, label: string) {
    setBusy(label);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setToast(data.message || "Done");
      router.refresh();
    } catch (e) {
      setToast("Error: " + String(e));
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 6000);
    }
  }

  const active = props.subs.filter((s) => s.status === "active");
  const upcoming = [...active]
    .filter((s) => s.nextDueAt)
    .sort((a, b) => +new Date(a.nextDueAt!) - +new Date(b.nextDueAt!))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {props.demoMode && (
        <div className="card border-warn/40 bg-warn/10 text-sm text-warn">
          Demo mode — showing sample data. Add a mailbox/bank in{" "}
          <a className="underline" href="/settings">Settings</a> and an Anthropic key to scan for real.
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Monthly spend" value={fmtMoney(props.totals.monthly)} accent />
        <Stat label="Annualized" value={fmtMoney(props.totals.yearly)} />
        <Stat label="Active subscriptions" value={String(props.totals.count)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Insights */}
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Money-leak insights</h2>
            <SyncButton onSync={() => post("/api/sync", {}, "sync")} busy={busy === "sync"} />
          </div>
          {props.insights.length === 0 ? (
            <p className="text-sm text-muted">No leaks detected. Nice.</p>
          ) : (
            <ul className="space-y-2">
              {props.insights.map((i, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span
                    className={`pill ${
                      i.severity === "bad" ? "bg-bad/20 text-bad" : i.severity === "warn" ? "bg-warn/20 text-warn" : "bg-brand/20 text-brand"
                    }`}
                  >
                    {i.kind.replace("_", " ")}
                  </span>
                  <span className="text-muted">{i.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Spend by category */}
        <div className="card">
          <h2 className="mb-3 font-semibold">Spend by category</h2>
          <CategoryChart data={props.byCategory} />
        </div>
      </div>

      {/* Upcoming renewals */}
      <div className="card">
        <h2 className="mb-3 font-semibold">Upcoming renewals</h2>
        <div className="flex flex-wrap gap-3">
          {upcoming.map((s) => (
            <div key={s.id} className="rounded-xl border border-edge px-3 py-2 text-sm">
              <div className="font-medium">{s.name}</div>
              <div className="text-muted">
                {fmtMoney(s.amount)} · {dueLabel(s.nextDueAt)}
              </div>
            </div>
          ))}
          {upcoming.length === 0 && <p className="text-sm text-muted">No dated renewals yet.</p>}
        </div>
      </div>

      {/* Subscription table */}
      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">All subscriptions</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="py-2">Service</th>
              <th>Amount</th>
              <th>Next due</th>
              <th>Source</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {props.subs.map((s) => (
              <tr key={s.id} className="border-t border-edge/60">
                <td className="py-3">
                  <div className="font-medium">
                    {s.name} {s.isTrial && <span className="pill bg-bad/20 text-bad">trial</span>}
                  </div>
                  <div className="text-xs text-muted">{s.category} · {Math.round(s.confidence * 100)}% sure</div>
                </td>
                <td>
                  <div>{fmtMoney(s.amount)}</div>
                  <div className="text-xs text-muted">{cycleLabel(s.cycle)} · {fmtMoney(monthlyEq(s.amount, s.cycle))}/mo</div>
                </td>
                <td>{dueLabel(s.nextDueAt)}</td>
                <td><span className="pill bg-edge text-muted">{s.source}</span></td>
                <td>
                  <StatusPill status={s.status} />
                </td>
                <td className="text-right">
                  <div className="inline-flex gap-2">
                    <button
                      className="btn-ghost"
                      disabled={busy !== null}
                      onClick={() => post(`/api/subscriptions/${s.id}`, { protected: !s.protected }, "protect-" + s.id)}
                      title={s.protected ? "Protected from auto-cancel" : "Protect from auto-cancel"}
                    >
                      {s.protected ? "🔒" : "🔓"}
                    </button>
                    <button
                      className="btn-ghost"
                      disabled={busy !== null || s.status !== "active"}
                      onClick={() => post("/api/cancel", { id: s.id, dryRun: true }, "dry-" + s.id)}
                    >
                      Dry-run
                    </button>
                    <button
                      className="btn-danger"
                      disabled={busy !== null || s.status !== "active" || s.protected}
                      onClick={() => post("/api/cancel", { id: s.id }, "cancel-" + s.id)}
                    >
                      {busy === "cancel-" + s.id ? "…" : "Cancel"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg border border-edge bg-panel px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card">
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${accent ? "text-brand" : ""}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-good/20 text-good",
    cancelling: "bg-warn/20 text-warn",
    cancelled: "bg-edge text-muted",
    paused: "bg-edge text-muted",
  };
  return <span className={`pill ${map[status] ?? "bg-edge text-muted"}`}>{status}</span>;
}

function SyncButton({ onSync, busy }: { onSync: () => void; busy: boolean }) {
  return (
    <button className="btn-primary" onClick={onSync} disabled={busy}>
      {busy ? "Syncing…" : "Sync now"}
    </button>
  );
}
