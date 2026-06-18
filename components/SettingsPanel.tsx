"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

interface Account { id: string; email: string; lastSyncedAt: string | null }
interface Bank { id: string; institution: string; lastSyncedAt: string | null }

interface Props {
  accounts: Account[];
  banks: Bank[];
  automationLevel: string;
  killSwitch: boolean;
  hasAnthropicKey: boolean;
  plaidReady: boolean;
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Automation */}
      <section className="card space-y-3">
        <h2 className="font-semibold">Automation</h2>
        <p className="text-sm text-muted">How much the AI may do when cancelling. You chose full-auto.</p>
        <div className="flex flex-wrap gap-2">
          {[
            ["full_auto", "Full auto"],
            ["auto_marketing", "Auto marketing, draft paid"],
            ["draft_only", "Draft only"],
          ].map(([val, label]) => (
            <button
              key={val}
              className={props.automationLevel === val ? "btn-primary" : "btn-ghost"}
              onClick={() => save("/api/settings", { automationLevel: val })}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={props.killSwitch}
            onChange={(e) => save("/api/settings", { killSwitch: e.target.checked ? "on" : "off" })}
          />
          Global kill-switch — pause ALL automated cancels
        </label>
      </section>

      {/* AI key */}
      <section className="card space-y-3">
        <h2 className="font-semibold">Claude API key {props.hasAnthropicKey && <span className="pill bg-good/20 text-good">set</span>}</h2>
        <KeyForm onSave={(k) => save("/api/settings", { anthropicApiKey: k })} />
        <p className="text-xs text-muted">Used for extracting subscription details and researching cancellations.</p>
      </section>

      {/* Email accounts */}
      <section className="card space-y-3">
        <h2 className="font-semibold">Email accounts</h2>
        {props.accounts.length > 0 && (
          <ul className="text-sm text-muted">
            {props.accounts.map((a) => (
              <li key={a.id}>• {a.email} {a.lastSyncedAt ? `(synced ${new Date(a.lastSyncedAt).toLocaleDateString()})` : "(not synced)"}</li>
            ))}
          </ul>
        )}
        <AccountForm onSave={(b) => save("/api/accounts", b)} />
        <p className="text-xs text-muted">
          Use an app-password (Gmail: Account → Security → App passwords), not your normal login. IMAP/SMTP hosts are auto-filled for common providers.
        </p>
      </section>

      {/* Bank */}
      <section className="card space-y-3">
        <h2 className="font-semibold">Bank & cards (Plaid)</h2>
        {props.banks.length > 0 && (
          <ul className="text-sm text-muted">
            {props.banks.map((b) => <li key={b.id}>• {b.institution}</li>)}
          </ul>
        )}
        {props.plaidReady ? (
          <PlaidButton onConnected={() => router.refresh()} setMsg={setMsg} />
        ) : (
          <p className="text-sm text-warn">Set PLAID_CLIENT_ID / PLAID_SECRET in .env to enable bank linking.</p>
        )}
      </section>

      {msg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg border border-edge bg-panel px-4 py-2 text-sm shadow-lg">{msg}</div>
      )}
    </div>
  );
}

function KeyForm({ onSave }: { onSave: (k: string) => void }) {
  const [k, setK] = useState("");
  return (
    <div className="flex gap-2">
      <input className="flex-1 rounded-lg border border-edge bg-ink px-3 py-1.5 text-sm" placeholder="sk-ant-..." value={k} onChange={(e) => setK(e.target.value)} />
      <button className="btn-primary" onClick={() => { onSave(k); setK(""); }}>Save</button>
    </div>
  );
}

function AccountForm({ onSave }: { onSave: (b: { email: string; password: string }) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <input className="flex-1 rounded-lg border border-edge bg-ink px-3 py-1.5 text-sm" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="flex-1 rounded-lg border border-edge bg-ink px-3 py-1.5 text-sm" placeholder="app-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
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
      className="btn-primary"
      onClick={async () => {
        if (!token) await start();
        else if (ready) open();
      }}
    >
      {token && ready ? "Open Plaid" : "Connect a bank"}
    </button>
  );
}
