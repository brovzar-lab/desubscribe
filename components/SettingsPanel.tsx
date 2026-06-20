"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

interface Account { id: string; email: string; authType: string; lastSyncedAt: string | null }
interface Bank { id: string; institution: string; lastSyncedAt: string | null }

interface Props {
  accounts: Account[];
  banks: Bank[];
  automationLevel: string;
  killSwitch: boolean;
  hasAnthropicKey: boolean;
  plaidReady: boolean;
  googleReady: boolean;
}

export default function SettingsPanel(props: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function save(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setMsg(data.message || "Saved");
    router.refresh();
    setTimeout(() => setMsg(null), 5000);
  }

  return (
    <div className="space-y-6 animate-stagger">
      <h1 className="text-2xl font-bold text-ink">Settings</h1>

      {/* ── Automation ───────────────────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <span className="text-xl">⚙️</span> Automation
        </h2>
        <p className="text-sm text-ink-2">How much the AI may do when cancelling.</p>
        <div className="flex flex-wrap gap-2">
          {([
            ["full_auto", "Full auto"],
            ["auto_marketing", "Auto marketing, draft paid"],
            ["draft_only", "Draft only"],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              className={
                props.automationLevel === val
                  ? "btn bg-accent text-white"
                  : "btn-ghost"
              }
              onClick={() => save("/api/settings", { automationLevel: val })}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Kill-switch toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={`toggle ${props.killSwitch ? "active" : ""}`}
            onClick={() => save("/api/settings", { killSwitch: props.killSwitch ? "off" : "on" })}
            role="switch"
            aria-checked={props.killSwitch}
          >
            <span className="toggle-dot" />
          </button>
          <span className="text-sm text-ink">Global kill-switch — pause ALL automated cancels</span>
        </div>
      </section>

      {/* ── Preferences ──────────────────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <span className="text-xl">🎛️</span> Preferences
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-ink">
            <span className="stat-label">Base currency (totals shown in this)</span>
            <select className="input" defaultValue="" onChange={(e) => e.target.value && save("/api/settings", { baseCurrency: e.target.value })}>
              <option value="" disabled>Choose…</option>
              {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "BRL", "MXN", "CHF", "SEK"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            <span className="stat-label">Digest email (defaults to first mailbox)</span>
            <DigestEmail onSave={(v) => save("/api/settings", { digestEmail: v })} />
          </label>
        </div>
      </section>

      {/* ── AI key ───────────────────────────────────────────────── */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <span className="text-xl">🧠</span> Claude API key
          {props.hasAnthropicKey && <span className="pill bg-success-soft text-on-success">set</span>}
        </h2>
        <KeyForm onSave={(k) => save("/api/settings", { anthropicApiKey: k })} />
        <p className="text-xs text-ink-3">Used for extracting subscription details and researching cancellations.</p>
      </section>

      {/* ── Email accounts ───────────────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <span className="text-xl">📧</span> Email accounts
        </h2>

        {/* Connected accounts list */}
        {props.accounts.length > 0 && (
          <div className="space-y-2">
            {props.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="avatar-initial bg-accent-soft text-on-soft !text-xs" style={{ width: 36, height: 36 }}>
                    {a.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{a.email}</p>
                    <p className="text-xs text-ink-3">
                      {a.lastSyncedAt ? `Synced ${new Date(a.lastSyncedAt).toLocaleDateString()}` : "Not synced"}
                    </p>
                  </div>
                </div>
                <span className="pill bg-sunken text-ink-3 shrink-0">
                  {a.authType === "gmail_oauth" ? "Google OAuth" : "IMAP"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Google connect */}
        <div className="rounded-lg border border-line bg-surface p-4 space-y-2">
          <h3 className="text-sm font-semibold text-ink">Connect with Google (recommended)</h3>
          {props.googleReady ? (
            <a
              className="btn-primary inline-flex items-center gap-2"
              href="/api/google/auth"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Connect Gmail with Google
            </a>
          ) : (
            <p className="text-sm text-warning">Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env to enable Google OAuth.</p>
          )}
          <p className="text-xs text-ink-3">Reads receipts, sends cancellations, and powers Google Calendar reminders.</p>
        </div>

        {/* IMAP connect */}
        <div className="rounded-lg border border-line bg-surface p-4 space-y-2">
          <h3 className="text-sm font-semibold text-ink">Or connect any mailbox via IMAP</h3>
          <AccountForm onSave={(b) => save("/api/accounts", b)} />
          <p className="text-xs text-ink-3">
            Use an app-password (not your normal login). IMAP/SMTP hosts auto-fill for Gmail/Outlook/Yahoo/iCloud.
          </p>
        </div>
      </section>

      {/* ── Bank & cards ─────────────────────────────────────────── */}
      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <span className="text-xl">🏦</span> Bank &amp; cards (Plaid)
        </h2>

        {props.banks.length > 0 && (
          <div className="space-y-2">
            {props.banks.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
                <div className="avatar-initial bg-accent-soft text-on-soft !text-xs" style={{ width: 36, height: 36 }}>
                  🏦
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{b.institution}</p>
                  <p className="text-xs text-ink-3">
                    {b.lastSyncedAt ? `Synced ${new Date(b.lastSyncedAt).toLocaleDateString()}` : "Not synced"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {props.plaidReady ? (
          <PlaidButton onConnected={() => router.refresh()} setMsg={setMsg} />
        ) : (
          <p className="text-sm text-warning">Set PLAID_CLIENT_ID / PLAID_SECRET in .env to enable bank linking.</p>
        )}
      </section>

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {msg && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 bg-accent rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-accent/20">
          {msg}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function DigestEmail({ onSave }: { onSave: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2">
      <input className="input" placeholder="you@example.com" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn-ghost" onClick={() => v && onSave(v)}>Save</button>
    </div>
  );
}

function KeyForm({ onSave }: { onSave: (k: string) => void }) {
  const [k, setK] = useState("");
  return (
    <div className="flex gap-2">
      <input className="input flex-1" placeholder="sk-ant-..." value={k} onChange={(e) => setK(e.target.value)} />
      <button className="btn-primary" onClick={() => { onSave(k); setK(""); }}>Save</button>
    </div>
  );
}

function AccountForm({ onSave }: { onSave: (b: { email: string; password: string }) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <input className="input flex-1" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input flex-1" placeholder="app-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="btn-primary" onClick={() => { onSave({ email, password }); setEmail(""); setPassword(""); }}>Connect</button>
    </div>
  );
}

function PlaidButton({ onConnected, setMsg }: { onConnected: () => void; setMsg: (s: string) => void }) {
  const [token, setToken] = useState<string | null>(null);

  const { open, ready } = usePlaidLink({
    token: token ?? "",
    onSuccess: async (public_token, metadata) => {
      const res = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token, institution: metadata.institution?.name }),
      });
      const data = await res.json();
      setMsg(data.message || "Connected");
      onConnected();
    },
  });

  async function start() {
    const res = await fetch("/api/plaid/link-token", { method: "POST" });
    const data = await res.json();
    if (data.link_token) setToken(data.link_token);
    else setMsg(data.message || "Plaid error");
  }

  return (
    <button
      className="btn-primary inline-flex items-center gap-2"
      onClick={async () => {
        if (!token) await start();
        else if (ready) open();
      }}
    >
      🏦 {token && ready ? "Open Plaid" : "Connect a bank"}
    </button>
  );
}
