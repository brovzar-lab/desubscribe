"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "./format";

interface QItem {
  id: string; name: string; category: string; amount: number | null; currency: string;
  cycle: string; source: string; confidence: number;
}

export default function ReviewPanel({ queue, candidates }: { queue: QItem[]; candidates: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});

  async function act(id: string, action: string, targetId?: string) {
    setBusy(true);
    const res = await fetch(`/api/subscriptions/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetId }),
    });
    const data = await res.json();
    setToast(data.message || "Done");
    setBusy(false);
    router.refresh();
    setTimeout(() => setToast(null), 6000);
  }

  if (queue.length === 0)
    return <div className="card text-sm text-muted">Nothing to review — every detection is high-confidence. 🎉</div>;

  return (
    <div className="space-y-3">
      {queue.map((s) => (
        <div key={s.id} className="card flex flex-wrap items-center gap-3">
          <div className="min-w-48 flex-1">
            <div className="font-medium">{s.name} <span className="pill bg-warn/20 text-warn">{Math.round(s.confidence * 100)}%</span></div>
            <div className="text-xs text-muted">{s.category} · {fmtMoney(s.amount, s.currency)} / {s.cycle} · {s.source}</div>
          </div>
          <button className="btn-primary" disabled={busy} onClick={() => act(s.id, "approve")}>Approve</button>
          <button className="btn-ghost" disabled={busy} onClick={() => act(s.id, "reject")}>Reject</button>
          <div className="flex items-center gap-1">
            <select
              className="input"
              value={mergeTarget[s.id] ?? ""}
              onChange={(e) => setMergeTarget((m) => ({ ...m, [s.id]: e.target.value }))}
            >
              <option value="">merge into…</option>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn-ghost" disabled={busy || !mergeTarget[s.id]} onClick={() => act(s.id, "merge", mergeTarget[s.id])}>Merge</button>
          </div>
        </div>
      ))}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg border border-edge bg-panel px-4 py-2 text-sm shadow-lg">{toast}</div>}
    </div>
  );
}
