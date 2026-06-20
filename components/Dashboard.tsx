"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Insight } from "@/lib/insights";
import type { Anomaly } from "@/lib/anomalies";
import CategoryChart from "./CategoryChart";
import TrendChart from "./TrendChart";
import ForecastChart from "./ForecastChart";
import { monthlyEq, fmtMoney, cycleLabel, dueLabel } from "./format";
import {
  RefreshCw, Plus, ClipboardPaste, MoreHorizontal, Upload, Camera, Download, Calendar, Mail, Trash2,
  Lock, Unlock, Search, AlertCircle, Lightbulb, ArrowRight, TrendingUp, TrendingDown, ChevronRight, X
} from "lucide-react";

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
  forecast: { month: string; projected: number }[];
  forecast12mo: number;
  baseCurrency: string;
  automationLevel: string;
  killSwitch: boolean;
  demoMode: boolean;
}

type Sort = "amount" | "name" | "due";

/* ── Insight badge → data-color soft tints (never amber/warning) ──── */
function insightBadge(kind: string): { cls: string; border: string } {
  switch (kind) {
    case "unused":
      return { cls: "bg-data-teal-soft text-on-data-teal", border: "var(--data-teal)" };
    case "pricey":
      return { cls: "bg-data-violet-soft text-on-data-violet", border: "var(--data-violet)" };
    case "trial_converting":
      return { cls: "bg-data-coral-soft text-on-data-coral", border: "var(--data-coral)" };
    case "duplicate":
      return { cls: "bg-data-blue-soft text-on-data-blue", border: "var(--data-blue)" };
    default:
      return { cls: "bg-accent-soft text-on-soft", border: "var(--accent)" };
  }
}

/* ── Data colors for brand dots (charts & status only) ─────────────── */
const DOT_COLORS = ["#2B54F0","#6E4BF0","#119C8B","#FF6B5C","#F5A524","#12A66B","#94A2BE","#5E80FF"];
function nameColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return DOT_COLORS[Math.abs(hash) % DOT_COLORS.length];
}

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
  const [showMore, setShowMore] = useState(false);
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

  const nextBill = useMemo(() => {
    const upcoming = props.subs.filter(s => s.nextDueAt && s.status === "active")
      .sort((a, b) => +new Date(a.nextDueAt!) - +new Date(b.nextDueAt!));
    return upcoming[0] || null;
  }, [props.subs]);

  return (
    <div className="space-y-6">
      {props.demoMode && (
        <div className="card text-sm animate-fade-in-up flex items-center gap-3" style={{ borderLeftWidth: 3, borderLeftColor: 'var(--warning)' }}>
          <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
          <span className="text-ink-2">Demo mode — sample data. Connect Gmail/IMAP/bank in <a className="underline font-medium text-accent cursor-pointer" href="/settings">Settings</a> + add a Claude key to scan for real.</span>
        </div>
      )}

      {/* ── Hero Section — Ring + Stats ──────────────────────── */}
      <div className="card animate-fade-in-up">
        <div className="flex flex-col sm:flex-row items-center gap-8 py-2">
          {/* Hero Ring */}
          <div className="relative flex-shrink-0">
            <HeroRing
              percent={Math.min(100, (props.totals.monthly / Math.max(props.totals.yearly / 12 * 1.5, 1)) * 100)}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="stat-label">Monthly</span>
              {/* Playfair hero number — THE ONE allowed per screen */}
              <span className="font-display text-3xl font-semibold text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(props.totals.monthly, props.baseCurrency)}</span>
              <span className="text-xs text-ink-3">per month</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 w-full">
            <StatTile label="Annualized" value={fmtMoney(props.totals.yearly, props.baseCurrency)} />
            <StatTile label="Active" value={String(props.totals.count)} />
            <StatTile label="Saved / yr" value={fmtMoney(props.savings.annualized, props.baseCurrency)} color="success" />
            <HealthTile health={props.health} />
          </div>
        </div>

        {nextBill && (
          <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-sm">
            <span className="text-ink-3">Next bill:</span>
            <span className="font-medium text-ink">{nextBill.name}</span>
            <span className="num text-ink-2">{fmtMoney(nextBill.amount, nextBill.currency)}</span>
            <span className="text-ink-3">· {dueLabel(nextBill.nextDueAt)}</span>
          </div>
        )}
      </div>

      {/* ── Insights ────────────────────────────────────────── */}
      {(props.insights.length > 0 || props.anomalies.length > 0) && (
        <div className="space-y-3">
          <h2 className="stat-label flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5" /> Insights
            {reviewCount > 0 && <Link href="/review" className="pill bg-accent-soft text-on-soft text-xs cursor-pointer">{reviewCount} to review <ArrowRight className="w-3 h-3 ml-0.5" /></Link>}
          </h2>

          {props.anomalies.length > 0 && (
            <div className="card" style={{ background: 'var(--error-soft)', borderLeft: '3px solid var(--error)' }}>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--on-error)' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {props.anomalies.length} billing anomal{props.anomalies.length === 1 ? "y" : "ies"}
              </h3>
              <ul className="space-y-1.5">
                {props.anomalies.slice(0, 5).map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="pill bg-error-soft text-on-error">{a.kind.replace(/_/g, " ")}</span>
                    <Link href={`/sub/${a.subscriptionId}`} className="text-ink-2 hover:text-ink transition-colors">{a.message}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {props.insights.slice(0, 6).map((i, idx) => {
              const badge = insightBadge(i.kind);
              return (
                <div key={idx} className="card !py-3 !px-4" style={{ borderLeftWidth: 3, borderLeftColor: badge.border }}>
                  <div className="flex items-start gap-2 text-sm">
                    <span className={`pill ${badge.cls}`}>
                      {i.kind.replace("_", " ")}
                    </span>
                    <span className="text-ink-2">{i.message}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Action Bar ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => post("/api/sync", {}, "sync")} disabled={busy === "sync"} aria-label="Sync subscriptions">
          <RefreshCw className={`w-4 h-4 ${busy === "sync" ? "animate-spin" : ""}`} />
          {busy === "sync" ? "Syncing…" : "Sync now"}
        </button>
        <button className="btn-ghost" onClick={() => setShowAdd((v) => !v)} aria-label="Add subscription">
          <Plus className="w-4 h-4" /> Add
        </button>
        <button className="btn-ghost" onClick={() => setShowPaste((v) => !v)} aria-label="Paste receipt">
          <ClipboardPaste className="w-4 h-4" /> Paste
        </button>

        <div className="relative">
          <button className="btn-ghost" onClick={() => setShowMore(v => !v)} aria-label="More actions" aria-expanded={showMore}>
            <MoreHorizontal className="w-4 h-4" /> More
          </button>
          {showMore && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowMore(false)} />
              <div className="dropdown-menu absolute top-full left-0 mt-1 z-30 min-w-[220px] animate-fade-in-up" role="menu">
                <DropItem icon={Upload} onClick={() => { csvRef.current?.click(); setShowMore(false); }}>Import CSV</DropItem>
                <DropItem icon={Camera} onClick={() => { imgRef.current?.click(); setShowMore(false); }}>Import screenshot</DropItem>
                <DropItem icon={Download} href="/api/export/csv">Export CSV</DropItem>
                <DropItem icon={Calendar} href="/api/calendar/ics">Download .ics</DropItem>
                <DropItem icon={Calendar} onClick={() => { post("/api/calendar/google", {}, "gcal"); setShowMore(false); }}>Google Calendar</DropItem>
                <DropItem icon={Mail} onClick={() => { post("/api/digest", {}, "digest"); setShowMore(false); }}>Email digest</DropItem>
                <div className="my-1 border-t border-line mx-2" />
                <DropItem icon={Trash2} onClick={() => { post("/api/cancel/bulk", { filter: "unused" }, "bulk-unused"); setShowMore(false); }} danger>Cancel unused</DropItem>
                <DropItem icon={Trash2} onClick={() => { post("/api/cancel/bulk", { filter: "trials" }, "bulk-trials"); setShowMore(false); }} danger>Cancel trials</DropItem>
              </div>
            </>
          )}
        </div>

        <input ref={csvRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && upload("/api/import/csv", e.target.files[0], "csv", false)} aria-label="Upload CSV file" />
        <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload("/api/import/screenshot", e.target.files[0], "img", true)} aria-label="Upload screenshot" />
      </div>

      {showAdd && <AddForm onAdd={(b) => { post("/api/subscriptions", b, "add"); setShowAdd(false); }} />}

      {showPaste && (
        <div className="card space-y-3 animate-fade-in-up">
          <p className="text-sm text-ink-2">Paste a forwarded receipt / billing email. Claude extracts the subscription.</p>
          <textarea className="input h-32 w-full text-sm" value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"From: billing@service.com\nSubject: Your receipt\n\nYou were charged $9.99…"} aria-label="Paste receipt text" />
          <button className="btn-primary" disabled={!pasteText.trim() || busy === "paste"} onClick={pasteReceipt}>{busy === "paste" ? "Reading…" : "Capture"}</button>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 w-4 h-4" />
          <input className="input pl-9 w-48" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search subscriptions" />
        </div>
        <Select value={statusFilter} onChange={setStatusFilter} options={["active", "cancelling", "cancelled", "all"]} label="Status" />
        <Select value={catFilter} onChange={setCatFilter} options={categories} label="Category" />
        <Select value={sort} onChange={(v) => setSort(v as Sort)} options={["amount", "name", "due"]} label="Sort" />
        <span className="ml-auto text-ink-3 num">{visible.length} shown</span>
      </div>

      {/* ── Bulk Actions ────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="card flex flex-wrap items-center gap-3 text-sm animate-fade-in-up" style={{ borderLeftWidth: 3, borderLeftColor: 'var(--accent)' }}>
          <span className="text-ink">{selected.size} selected · save <b className="text-success num">{fmtMoney(selectedSavings, props.baseCurrency)}/yr</b></span>
          <button className="btn-ghost text-xs" onClick={() => post("/api/cancel/bulk", { ids: [...selected], dryRun: true }, "bulk-dry")} disabled={busy !== null}>Dry-run</button>
          <button className="btn-danger text-xs" onClick={() => post("/api/cancel/bulk", { ids: [...selected] }, "bulk-sel")} disabled={busy !== null}>Cancel selected</button>
          <button className="btn-ghost text-xs" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {/* ── Subscription List ────────────────────────────────── */}
      <div className="card !p-0 divide-y divide-line overflow-hidden">
        {visible.map((s) => (
          <div key={s.id} className={`sub-row flex items-center gap-4 px-5 py-3.5 ${selected.has(s.id) ? "bg-accent-soft" : ""}`}>
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
              className="h-4 w-4 rounded-sm flex-shrink-0"
              style={{ accentColor: 'var(--accent)' }}
            />

            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: nameColor(s.name) }} />

            <div className="flex-1 min-w-0">
              <Link href={`/sub/${s.id}`} className="font-medium text-ink truncate hover:text-accent transition-colors duration-100 block">
                {s.name}
              </Link>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-ink-3">{s.category}</span>
                {s.isTrial && <span className="pill bg-data-coral-soft text-on-data-coral" style={{ fontSize: 10, padding: '0 6px' }}>trial</span>}
                {s.priceChangedAt && <span className="pill bg-data-violet-soft text-on-data-violet" style={{ fontSize: 10, padding: '0 6px' }}>price ↑</span>}
                {s.reviewNeeded && <span className="pill bg-accent-soft text-on-soft" style={{ fontSize: 10, padding: '0 6px' }}>review</span>}
              </div>
            </div>

            <span className="text-xs text-ink-3 hidden sm:block flex-shrink-0 w-20">{dueLabel(s.nextDueAt)}</span>

            <div className="text-right flex-shrink-0 w-24">
              <div className="font-semibold text-ink num">{fmtMoney(s.amount, s.currency)}</div>
              <div className="text-xs text-ink-3">{cycleLabel(s.cycle)}</div>
            </div>

            <StatusDot status={s.status} />

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                className="p-1.5 rounded-sm text-ink-3 hover:text-ink cursor-pointer transition-colors duration-100"
                disabled={busy !== null}
                onClick={() => post(`/api/subscriptions/${s.id}`, { protected: !s.protected }, "protect-" + s.id)}
                title={s.protected ? "Unprotect" : "Protect"}
                aria-label={s.protected ? `Unprotect ${s.name}` : `Protect ${s.name}`}
              >
                {s.protected ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
              <button
                className="btn-ghost !px-2 !py-0.5 text-xs"
                disabled={busy !== null || s.status !== "active" || s.protected}
                onClick={() => post("/api/cancel", { id: s.id }, "cancel-" + s.id)}
              >
                {busy === "cancel-" + s.id ? "…" : "Cancel"}
              </button>
            </div>
          </div>
        ))}

        {visible.length === 0 && (
          <div className="empty-state">
            <p>No subscriptions found</p>
            <button className="btn-ghost text-sm" onClick={() => { setQuery(""); setStatusFilter("all"); setCatFilter("all"); }}>Clear filters</button>
          </div>
        )}
      </div>

      {/* ── Charts ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="stat-label mb-3">Spend over time</h2>
          <TrendChart data={props.trend} />
        </div>
        <div className="card">
          <h2 className="stat-label mb-3">By category</h2>
          <CategoryChart data={props.byCategory} />
        </div>
      </div>

      {/* ── 12-Month Forecast ────────────────────────────────── */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="stat-label">12-month forecast</h2>
          <span className="text-sm text-ink-2">projected <b className="text-ink num">{fmtMoney(props.forecast12mo, props.baseCurrency)}</b></span>
        </div>
        <ForecastChart data={props.forecast} currency={props.baseCurrency} />
      </div>

      {/* ── Toast ────────────────────────────────────────────── */}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Helper Functions ───────────────────────────────────────────────── */

function formData(file: File): FormData {
  const fd = new FormData();
  fd.append("image", file);
  return fd;
}

/* ── Hero Ring ──────────────────────────────────────────────────────── */
function HeroRing({ percent }: { percent: number }) {
  const size = 140;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="progress-ring">
      <circle className="progress-ring__track" cx={size/2} cy={size/2} r={r} strokeWidth={8} />
      <circle
        className="progress-ring__fill animate-ring-fill"
        cx={size/2} cy={size/2} r={r}
        stroke="var(--accent)"
        strokeWidth={8}
        strokeDasharray={circ}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

/* ── Stat Tile — always Schibsted, never Playfair ───────────────────────── */
function StatTile({ label, value, color }: { label: string; value: string; color?: "success" }) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className={`stat-value font-sans text-xl mt-1 num ${color === "success" ? "text-success" : "text-ink"}`}>{value}</div>
    </div>
  );
}

/* ── Health Tile — Schibsted, never Playfair ──────────────────────── */
function HealthTile({ health }: { health: { score: number; grade: string; reasons: string[] } }) {
  const cls = health.score >= 80 ? "text-success" : health.score >= 60 ? "text-on-warning" : "text-on-error";
  return (
    <div className="stat-tile" title={health.reasons.join(" · ")}>
      <div className="stat-label">Health</div>
      <div className={`stat-value font-sans text-xl mt-1 ${cls}`}>
        {health.grade} <span className="text-sm text-ink-3 font-normal">({health.score})</span>
      </div>
    </div>
  );
}

/* ── Status Dot ─────────────────────────────────────────────────────── */
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-success", cancelling: "bg-warning", cancelled: "bg-ink-3", paused: "bg-ink-3",
  };
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0" title={status}>
      <span className={`w-2 h-2 rounded-full ${colors[status] ?? "bg-ink-3"}`} />
      <span className="text-xs text-ink-3 hidden md:inline">{status}</span>
    </div>
  );
}

/* ── Dropdown Item — with Lucide icon ──────────────────────────────── */
function DropItem({ children, onClick, href, danger, icon: Icon }: { children: React.ReactNode; onClick?: () => void; href?: string; danger?: boolean; icon?: React.ComponentType<{ className?: string }> }) {
  const cls = `dropdown-item flex items-center gap-2 ${danger ? "danger" : ""}`;
  const content = <>{Icon && <Icon className="w-4 h-4 flex-shrink-0" />}{children}</>;
  if (href) return <a href={href} className={cls} role="menuitem">{content}</a>;
  return <button onClick={onClick} className={cls} role="menuitem">{content}</button>;
}

/* ── Select ─────────────────────────────────────────────────────────── */
function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <label className="flex items-center gap-1.5 text-ink-3">
      <span className="text-xs font-medium">{label}:</span>
      <select className="input !py-1 !px-2 text-xs" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

/* ── Add Form ───────────────────────────────────────────────────────── */
function AddForm({ onAdd }: { onAdd: (b: Record<string, unknown>) => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState("monthly");
  const [category, setCategory] = useState("Other");
  return (
    <div className="card flex flex-wrap items-end gap-3 text-sm animate-fade-in-up">
      <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Audible" /></Field>
      <Field label="Amount"><input className="input w-24" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="14.95" /></Field>
      <Field label="Cycle">
        <select className="input" value={cycle} onChange={(e) => setCycle(e.target.value)}>
          {["weekly", "monthly", "quarterly", "yearly"].map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Category"><input className="input w-28" value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
      <button className="btn-primary" disabled={!name} onClick={() => onAdd({ name, amount: amount ? Number(amount) : undefined, cycle, category })}>+ Add</button>
    </div>
  );
}

/* ── Field ──────────────────────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      {children}
    </label>
  );
}
