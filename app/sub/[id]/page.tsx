import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { monthlyAmount } from "@/lib/insights";
import { hasPlaybook } from "@/lib/cancel/playbooks";
import SubDetail from "@/components/SubDetail";

export const dynamic = "force-dynamic";

export default async function SubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: {
      charges: { orderBy: { date: "desc" }, take: 24 },
      actions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!sub) notFound();

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-muted hover:text-white">← Back to dashboard</Link>
      <SubDetail
        sub={{
          id: sub.id,
          name: sub.name,
          category: sub.category,
          amount: sub.amount,
          currency: sub.currency,
          cycle: sub.cycle,
          monthly: monthlyAmount(sub.amount, sub.cycle),
          status: sub.status,
          source: sub.source,
          confidence: sub.confidence,
          protected: sub.protected,
          isTrial: sub.isTrial,
          nextDueAt: sub.nextDueAt?.toISOString() ?? null,
          previousAmount: sub.previousAmount,
          priceChangedAt: sub.priceChangedAt?.toISOString() ?? null,
          cancelUrl: sub.cancelUrl,
          notes: sub.notes,
          knownPlaybook: hasPlaybook(sub.name),
        }}
        charges={sub.charges.map((c) => ({ date: c.date.toISOString(), amount: c.amount, source: c.source, description: c.description }))}
        actions={sub.actions.map((a) => ({ type: a.type, status: a.status, detail: a.detail, createdAt: a.createdAt.toISOString() }))}
      />
    </div>
  );
}
