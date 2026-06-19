"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (res.ok) window.location.href = "/";
    else setError((await res.json()).message || "Failed");
    setBusy(false);
  }

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-1 text-center text-2xl font-bold">de<span className="text-brand">subscribe</span></h1>
      <p className="mb-6 text-center text-sm text-muted">Enter your password to continue.</p>
      <form onSubmit={submit} className="card space-y-3">
        <input
          autoFocus
          type="password"
          className="input w-full"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-bad">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || !password}>{busy ? "…" : "Sign in"}</button>
      </form>
    </div>
  );
}
