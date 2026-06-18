import { prisma } from "@/lib/db";
import { computeInsights, totals, spendByCategory, type SubLike } from "@/lib/insights";
import { savings, healthScore, spendTrend } from "@/lib/analytics";
import { getAutomationLevel, isKillSwitchOn, isDemoMode } from "@/lib/settings";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [rows, charges] = await Promise.all([
    prisma.subscription.findMany({ orderBy: { amount: "desc" } }),
    prisma.chargeEvent.findMany({ select: { date: true, amount: true }, orderBy: { date: "desc" }, take: 1000 }),
  ]);

  const subs: SubLike[] = rows.map((r) => ({
    id: r.id, name: r.name, amount: r.amount, cycle: r.cycle, status: r.status,
    category: r.category, nextDueAt: r.nextDueAt, lastChargeAt: r.lastChargeAt,
    isTrial: r.isTrial, source: r.source,
  }));

  const t = totals(subs);
  const insights = computeInsights(subs);
  const byCat = spendByCategory(subs);
  const save = savings(rows.map((r) => ({ ...subs.find((s) => s.id === r.id)!, cancelledAt: r.cancelledAt })));
  const health = healthScore(subs, {
    trial: insights.filter((i) => i.kind === "trial_converting").length,
    unused: insights.filter((i) => i.kind === "unused").length,
    duplicate: insights.filter((i) => i.kind === "duplicate").length,
  });
  const trend = spendTrend(charges, 6);

  const [level, killed, demo] = await Promise.all([
    getAutomationLevel(),
    isKillSwitchOn(),
    isDemoMode(),
  ]);

  const clientSubs = rows.map((r) => ({
    id: r.id, name: r.name, category: r.category, amount: r.amount, currency: r.currency,
    cycle: r.cycle, status: r.status, source: r.source, confidence: r.confidence,
    protected: r.protected, isTrial: r.isTrial, reviewNeeded: r.reviewNeeded,
    nextDueAt: r.nextDueAt?.toISOString() ?? null,
    lastChargeAt: r.lastChargeAt?.toISOString() ?? null,
    hasUnsub: !!r.unsubData, cancelUrl: r.cancelUrl,
    priceChangedAt: r.priceChangedAt?.toISOString() ?? null,
  }));

  return (
    <Dashboard
      subs={clientSubs}
      totals={t}
      insights={insights}
      byCategory={byCat}
      savings={save}
      health={health}
      trend={trend}
      automationLevel={level}
      killSwitch={killed}
      demoMode={demo}
    />
  );
}
