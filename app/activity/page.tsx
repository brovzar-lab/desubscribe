import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Audit trail — every automated action (full-auto safety / transparency).
export default async function ActivityPage() {
  const logs = await prisma.actionLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { subscription: { select: { name: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Activity & audit log</h1>
      <p className="text-sm text-muted">Everything the AI did — one-click unsubscribes, emails sent, web cancels (with screenshots), and syncs.</p>
      <div className="card overflow-x-auto">
        {logs.length === 0 ? (
          <p className="text-sm text-muted">No actions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-2">When</th>
                <th>Service</th>
                <th>Type</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-edge/60 align-top">
                  <td className="py-2 whitespace-nowrap text-muted">{l.createdAt.toLocaleString()}</td>
                  <td>{l.subscription?.name ?? "—"}</td>
                  <td><span className="pill bg-edge text-muted">{l.type}</span></td>
                  <td>
                    <span className={`pill ${statusColor(l.status)}`}>{l.status}</span>
                  </td>
                  <td className="text-muted">
                    {l.detail}
                    {l.screenshotPath && <div className="text-xs text-brand">📸 {l.screenshotPath}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function statusColor(s: string): string {
  if (s === "success") return "bg-good/20 text-good";
  if (s === "failed") return "bg-bad/20 text-bad";
  if (s === "dry_run") return "bg-brand/20 text-brand";
  return "bg-warn/20 text-warn";
}
