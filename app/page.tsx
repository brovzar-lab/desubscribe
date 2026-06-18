import { prisma } from "@/lib/db";
import { computeInsights, totals, spendByCategory, type SubLike } from "@/lib/insights";
import { getAutomationLevel, isKillSwitchOn, isDemoMode } from "@/lib/settings";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = await prisma.subscription.findMany({ orderBy: { amount: "desc" } });
  const subs: SubLike[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    cycle: r.cycle,
    status: r.status,
    category: r.category,
    nextDueAt: r.nextDueAt,
    lastChargeAt: r.lastChargeAt,
    isTrial: r.isTrial,
    source: r.source,
  }));

  const t = totals(subs);
  const insights = computeInsights(subs);
  const byCat = spendByCategory(subs);
  const [level, killed, demo] = await Promise.all([
    getAutomationLevel(),
    isKillSwitchOn(),
    isDemoMode(),
  ]);

  // Serialize for the client component.
  const clientSubs = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    amount: r.amount,
    currency: r.currency,
    cycle: r.cycle,
    status: r.status,
    source: r.source,
    confidence: r.confidence,
    protected: r.protected,
    isTrial: r.isTrial,
    nextDueAt: r.nextDueAt?.toISOString() ?? null,
    lastChargeAt: r.lastChargeAt?.toISOString() ?? null,
    hasUnsub: !!r.unsubData,
    cancelUrl: r.cancelUrl,
  }));

  return (
    <Dashboard
      subs={clientSubs}
      totals={t}
      insights={insights}
      byCategory={byCat}
      automationLevel={level}
      killSwitch={killed}
      demoMode={demo}
    />
  );
}
