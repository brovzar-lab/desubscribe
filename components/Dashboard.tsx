"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Insight } from "@/lib/insights";
import type { Anomaly } from "@/lib/anomalies";
import CategoryChart from "./CategoryChart";
import TrendChart from "./TrendChart";
import { monthlyEq, fmtMoney, cycleLabel, dueLabel } from "./format";

export interface ClientSub {
  id: string; name: string; category: string; amount: number | null; currency: string;
  baseAmount: number | null;
  cycle: string; status: string; source: string; confidence: number; protected: boolean;
  isTrial: boolean; reviewNeeded: boolean; nextDueAt: string | null; lastChargeAt: string | null;
  hasUnsub: boolean; cancelUrl: string | null; priceChangedAt: string | null;
}

interface Props {
  subs: ClientSub[];
  totals: { monthly: number; yearly: number; count: number };
  insights: Insight[];
  byCategory: { category: string; monthly: number }[];
  savings: { monthly: number; annualized: number; realized: number; count: number };
  health: { score: number; grade: string; reasons: string[] };
  trend: { month: string; total: number }[];
  anomalies: Anomaly[];
  baseCurrency: string;
  automationLevel: string;
  killSwitch: boolean;
  demoMode: boolean;
}

type Sort = "amount" | "name" | "due";

export default function Dashboard(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [catFilter, setCatFilter] = useState("all");
  const [sort, setSort] = useState<Sort>("amount");
  const [showAdd, setShowAdd] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const csvRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  async function pasteReceipt() {
    setBusy("paste");
    try {
      const res = await fetch("/api/ingest/email", { method: "POST", headers: { "Content-Type": "text/plain" }, body: pasteText });
      const data = await res.json();
      setToast(data.message || "Done");
      setPasteText("");
      setShowPaste(false);
      router.refresh();
    } catch (e) {
      setToast("Error: " + String(e));
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 7000);
    }
  }

  async function post(url: string, body: unknown, label: string) {
    setBusy(label);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      setToast(data.message || "Done");
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setToast("Error: " + String(e));
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 7000);
    }
  }

  async function upload(url: string, file: File, label: string, asForm: boolean) {
    setBusy(label);
    try {
      const res = await fetch(url, asForm
        ? { method: "POST", body: formData(file) }
        : { method: "POST", headers: { "Content-Type": "text/csv" }, body: await file.text() });
      const data = await res.json();
      setToast(data.message || "Done");
      router.refresh();
    } catch (e) {
      setToast("Error: " + String(e));
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 7000);
    }
  }

  const categories = useMemo(() => ["all", ...new Set(props.subs.map((s) => s.category))], [props.subs]);

  const visible = useMemo(() => {
    let list = props.subs;
    if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);
    if (catFilter !== "all") list = list.filter((s) => s.category === catFilter);
    if (query.trim()) list = list.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "due") return (a.nextDueAt ? +new Date(a.nextDueAt) : Infinity) - (b.nextDueAt ? +new Date(b.nextDueAt) : Infinity);
      return monthlyEq(b.baseAmount, b.cycle) - monthlyEq(a.baseAmount, a.cycle);
    });
  }, [props.subs, statusFilter, catFilter, query, sort]);

  const reviewCount = props.subs.filter((s) => s.reviewNeeded && s.status === "active").length;
  const selectedSavings = props.subs
    .filter((s) => selected.has(s.id))
    .reduce((sum, s) => sum + monthlyEq(s.baseAmount, s.cycle) * 12, 0);

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  return (
    <div className="space-y-6">
      {props.demoMode && (
        <div className="card border-warn/40 bg-warn/10 text-sm text-warn">
          Demo mode — sample data. Connect Gmail/IMAP/bank in <a className="underline" href="/settings">Settings</a> + add a Claude key to scan for real.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Monthly spend" value={fmtMoney(props.totals.monthly, props.baseCurrency)} accent />
        <Stat label="Annualized" value={fmtMoney(props.totals.yearly, props.baseCurrency)} />
        <Stat label="Active" value={String(props.totals.count)} />
        <Stat label="Saved / yr" value={fmtMoney(props.savings.annualized, props.baseCurrency)} good />
        <HealthStat health={props.health} />
      </div>

      {/* Toolbar */}
      <div className="card flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => post("/api/sync", {}, "sync")} disabled={busy === "sync"}>
          {busy === "sync" ? "Syncing…" : "Sync now"}
        </button>
        <button className="btn-ghost" onClick={() => setShowAdd((v) => !v)}>+ Add</button>
        <button className="btn-ghost" onClick={() => setShowPaste((v) => !v)}>Paste receipt</button>
        <button className="btn-ghost" onClick={() => csvRef.current?.click()}>Import CSV</button>
        <button className="btn-ghost" onClick={() => imgRef.current?.click()}>Import screenshot</button>
        <a className="btn-ghost" href="/api/export/csv">Export CSV</a>
        <a className="btn-ghost" href="/api/calendar/ics">Download .ics</a>
        <button className="btn-ghost" onClick={() => post("/api/calendar/google", {}, "gcal")} disabled={busy === "gcal"}>Push to Google Calendar</button>
        <button className="btn-ghost" onClick={() => post("/api/digest", {}, "digest")} disabled={busy === "digest"}>Email me a digest</button>
        <div className="mx-1 h-5 w-px bg-edge" />
        <button className="btn-danger" onClick={() => post("/api/cancel/bulk", { filter: "unused" }, "bulk-unused")} disabled={busy !== null}>
          Cancel all unused
        </button>
        <button className="btn-danger" onClick={() => post("/api/cancel/bulk", { filter: "trials" }, "bulk-trials")} disabled={busy !== null}>
          Cancel converting trials
        </button>
        <input ref={csvRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && upload("/api/import/csv", e.target.files[0], "csv", false)} />
        <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload("/api/import/screenshot", e.target.files[0], "img", true)} />
      </div>

      {showAdd && <AddForm onAdd={(b) => { post("/api/subscriptions", b, "add"); setShowAdd(false); }} />}

      {showPaste && (
        <div className="card space-y-2">
          <p className="text-sm text-muted">Paste a forwarded receipt / billing email (raw or just the text). Claude extracts the subscription.</p>
          <textarea className="input h-32 w-full font-mono" value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="From: billing@service.com&#10;Subject: Your receipt&#10;&#10;You were charged $9.99…" />
          <button className="btn-primary" disabled={!pasteText.trim() || busy === "paste"} onClick={pasteReceipt}>{busy === "paste" ? "Reading…" : "Capture"}</button>
        </div>
      )}

      {/* Billing anomalies — surfaced loudly, they cost real money */}
      {props.anomalies.length > 0 && (
        <div className="card border-bad/40 bg-bad/10">
          <h2 className="mb-2 font-semibold text-bad">⚠ Billing anomalies ({props.anomalies.length})</h2>
          <ul className="space-y-1 text-sm">
            {props.anomalies.slice(0, 8).map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`pill ${a.severity === "bad" ? "bg-bad/20 text-bad" : "bg-warn/20 text-warn"}`}>{a.kind.replace(/_/g, " ")}</span>
                <Link href={`/sub/${a.subscriptionId}`} className="text-muted hover:text-white">{a.message}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Insights + charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Money-leak insights {reviewCount > 0 && <Link href="/review" className="pill bg-warn/20 text-warn hover:brightness-125">{reviewCount} to review →</Link>}</h2>
          {props.insights.length === 0 ? (
            <p className="text-sm text-muted">No leaks detected. Nice.</p>
          ) : (
            <ul className="space-y-2">
              {props.insights.map((i, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className={`pill ${i.severity === "bad" ? "bg-bad/20 text-bad" : i.severity === "warn" ? "bg-warn/20 text-warn" : "bg-brand/20 text-brand"}`}>
                    {i.kind.replace("_", " ")}
                  </span>
                  <span className="text-muted">{i.message}</span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-2 mt-5 text-sm font-semibold text-muted">Spend over time</h3>
          <TrendChart data={props.trend} />
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Spend by category</h2>
          <CategoryChart data={props.byCategory} />
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-2 text-sm">
        <input className="rounded-lg border border-edge bg-ink px-3 py-1.5" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={statusFilter} onChange={setStatusFilter} options={["active", "cancelling", "cancelled", "all"]} label="Status" />
        <Select value={catFilter} onChange={setCatFilter} options={categories} label="Category" />
        <Select value={sort} onChange={(v) => setSort(v as Sort)} options={["amount", "name", "due"]} label="Sort" />
        <span className="ml-auto text-muted">{visible.length} shown</span>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="card flex flex-wrap items-center gap-3 border-brand/40 bg-brand/10 text-sm">
          <span>{selected.size} selected · what-if savings <b className="text-good">{fmtMoney(selectedSavings, props.baseCurrency)}/yr</b></span>
          <button className="btn-ghost" onClick={() => post("/api/cancel/bulk", { ids: [...selected], dryRun: true }, "bulk-dry")} disabled={busy !== null}>Dry-run</button>
          <button className="btn-danger" onClick={() => post("/api/cancel/bulk", { ids: [...selected] }, "bulk-sel")} disabled={busy !== null}>Cancel selected</button>
          <button className="btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="w-6"></th>
              <th className="py-2">Service</th>
              <th>Amount</th>
              <th>Next due</th>
              <th>Source</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className="border-t border-edge/60">
                <td><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} /></td>
                <td className="py-3">
                  <Link href={`/sub/${s.id}`} className="font-medium hover:text-brand">
                    {s.name}
                  </Link>
                  {s.isTrial && <span className="pill bg-bad/20 text-bad ml-1">trial</span>}
                  {s.priceChangedAt && <span className="pill bg-warn/20 text-warn ml-1">price ↑</span>}
                  {s.reviewNeeded && <span className="pill bg-warn/20 text-warn ml-1">review</span>}
                  <div className="text-xs text-muted">{s.category} · {Math.round(s.confidence * 100)}% sure</div>
                </td>
                <td>
                  <div>{fmtMoney(s.amount, s.currency)}</div>
                  <div className="text-xs text-muted">{cycleLabel(s.cycle)} · {fmtMoney(monthlyEq(s.amount, s.cycle), s.currency)}/mo</div>
                </td>
                <td>{dueLabel(s.nextDueAt)}</td>
                <td><span className="pill bg-edge text-muted">{s.source}</span></td>
                <td><StatusPill status={s.status} /></td>
                <td className="text-right">
                  <div className="inline-flex gap-2">
                    <button className="btn-ghost" disabled={busy !== null} onClick={() => post(`/api/subscriptions/${s.id}`, { protected: !s.protected }, "protect-" + s.id)} title="Protect from auto-cancel">
                      {s.protected ? "🔒" : "🔓"}
                    </button>
                    <button className="btn-danger" disabled={busy !== null || s.status !== "active" || s.protected} onClick={() => post("/api/cancel", { id: s.id }, "cancel-" + s.id)}>
                      {busy === "cancel-" + s.id ? "…" : "Cancel"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg border border-edge bg-panel px-4 py-2 text-sm shadow-lg">{toast}</div>}
    </div>
  );
}

function formData(file: File): FormData {
  const fd = new FormData();
  fd.append("image", file);
  return fd;
}

function Stat({ label, value, accent, good }: { label: string; value: string; accent?: boolean; good?: boolean }) {
  return (
    <div className="card">
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-brand" : good ? "text-good" : ""}`}>{value}</div>
    </div>
  );
}

function HealthStat({ health }: { health: { score: number; grade: string; reasons: string[] } }) {
  const color = health.score >= 80 ? "text-good" : health.score >= 60 ? "text-warn" : "text-bad";
  return (
    <div className="card" title={health.reasons.join(" · ")}>
      <div className="text-xs uppercase text-muted">Health</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{health.grade} <span className="text-base text-muted">({health.score})</span></div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-good/20 text-good", cancelling: "bg-warn/20 text-warn",
    cancelled: "bg-edge text-muted", paused: "bg-edge text-muted",
  };
  return <span className={`pill ${map[status] ?? "bg-edge text-muted"}`}>{status}</span>;
}

function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <label className="flex items-center gap-1 text-muted">
      {label}:
      <select className="rounded-lg border border-edge bg-ink px-2 py-1 text-white" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function AddForm({ onAdd }: { onAdd: (b: Record<string, unknown>) => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState("monthly");
  const [category, setCategory] = useState("Other");
  return (
    <div className="card flex flex-wrap items-end gap-2 text-sm">
      <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Audible" /></Field>
      <Field label="Amount"><input className="input w-24" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="14.95" /></Field>
      <Field label="Cycle">
        <select className="input" value={cycle} onChange={(e) => setCycle(e.target.value)}>
          {["weekly", "monthly", "quarterly", "yearly"].map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Category"><input className="input w-28" value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
      <button className="btn-primary" disabled={!name} onClick={() => onAdd({ name, amount: amount ? Number(amount) : undefined, cycle, category })}>Add</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}
