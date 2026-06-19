import Link from "next/link";
import { prisma } from "@/lib/db";
import ReviewPanel from "@/components/ReviewPanel";

export const dynamic = "force-dynamic";

// The review inbox: low-confidence detections to approve / reject / merge.
export default async function ReviewPage() {
  const all = await prisma.subscription.findMany({ orderBy: { confidence: "asc" } });
  const queue = all.filter((s) => (s.reviewNeeded || s.confidence < 0.5) && s.status === "active");
  const candidates = all
    .filter((s) => !queue.some((q) => q.id === s.id))
    .map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Review inbox</h1>
        <Link href="/" className="text-sm text-muted hover:text-white">← Dashboard</Link>
      </div>
      <p className="text-sm text-muted">
        Low-confidence detections. Approve to trust them, reject to drop them, or merge a duplicate into the real
        subscription — merging <b>teaches</b> the app so future syncs fold that variant automatically.
      </p>
      <ReviewPanel
        queue={queue.map((s) => ({
          id: s.id, name: s.name, category: s.category, amount: s.amount, currency: s.currency,
          cycle: s.cycle, source: s.source, confidence: s.confidence,
        }))}
        candidates={candidates}
      />
    </div>
  );
}
