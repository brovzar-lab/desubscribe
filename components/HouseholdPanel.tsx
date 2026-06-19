"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "./format";

interface Member { id: string; name: string; isSelf: boolean; color: string | null }
interface SubRow { id: string; name: string; baseMonthly: number; memberIds: string[] }

interface Props {
  baseCurrency: string;
  members: Member[];
  perMember: { id: string; name: string; isSelf: boolean; monthly: number }[];
  yourShare: number;
  totalActive: number;
  subs: SubRow[];
}

export default function HouseholdPanel(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    setToast(data.message || "Done");
    setBusy(false);
    router.refresh();
    setTimeout(() => setToast(null), 5000);
  }

  function toggleMember(sub: SubRow, memberId: string) {
    const has = sub.memberIds.includes(memberId);
    const next = has ? sub.memberIds.filter((m) => m !== memberId) : [...sub.memberIds, memberId];
    call(`/api/subscriptions/${sub.id}/share`, "POST", { memberIds: next });
  }

  const fmt = (n: number) => fmtMoney(n, props.baseCurrency);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Household total / mo" value={fmt(props.totalActive)} />
        <Stat label="Your share / mo" value={fmt(props.yourShare)} accent />
        <Stat label="Your share / yr" value={fmt(props.yourShare * 12)} />
      </div>

      {/* Members */}
      <div className="card space-y-3">
        <h2 className="font-semibold">Members</h2>
        <div className="flex flex-wrap gap-2">
          {props.perMember.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-xl border border-edge px-3 py-2 text-sm">
              <span className="font-medium">{m.name}{m.isSelf && " (you)"}</span>
              <span className="text-muted">{fmt(m.monthly)}/mo</span>
              <button className="text-muted hover:text-bad" disabled={busy} onClick={() => call(`/api/members/${m.id}`, "DELETE")}>✕</button>
            </div>
          ))}
          {props.members.length === 0 && <p className="text-sm text-muted">Add yourself + housemates/family, then assign subscriptions below.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className="input" placeholder="Member name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary" disabled={!name || busy} onClick={() => { call("/api/members", "POST", { name, isSelf: props.members.length === 0 }); setName(""); }}>
            Add member
          </button>
          <span className="text-xs text-muted">First member added is marked “you”.</span>
        </div>
      </div>

      {/* Assignment grid */}
      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Split each subscription</h2>
        {props.members.length === 0 ? (
          <p className="text-sm text-muted">Add members first.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr><th className="py-2">Subscription</th><th>Cost/mo</th><th>Split between (click to toggle)</th><th>Per person</th></tr>
            </thead>
            <tbody>
              {props.subs.map((s) => {
                const n = s.memberIds.length || 1;
                return (
                  <tr key={s.id} className="border-t border-edge/60">
                    <td className="py-2 font-medium">{s.name}</td>
                    <td>{fmt(s.baseMonthly)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {props.members.map((m) => {
                          const on = s.memberIds.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              disabled={busy}
                              onClick={() => toggleMember(s, m.id)}
                              className={`pill border ${on ? "text-white" : "text-muted"} `}
                              style={{ borderColor: m.color ?? "#1e2842", background: on ? (m.color ?? "#6d8bff") + "33" : "transparent" }}
                            >
                              {m.name}{m.isSelf ? " (you)" : ""}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="text-muted">{s.memberIds.length ? fmt(s.baseMonthly / n) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg border border-edge bg-panel px-4 py-2 text-sm shadow-lg">{toast}</div>}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card">
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-brand" : ""}`}>{value}</div>
    </div>
  );
}
