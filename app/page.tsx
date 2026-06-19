import { prisma } from "@/lib/db";
import { computeInsights, totals, spendByCategory, type SubLike } from "@/lib/insights";
import { savings, healthScore, spendTrend } from "@/lib/analytics";
import { detectAnomalies, type SubWithCharges } from "@/lib/anomalies";
import { getBaseCurrency, getRates, convert } from "@/lib/fx";
import { getAutomationLevel, isKillSwitchOn, isDemoMode } from "@/lib/settings";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = await prisma.subscription.findMany({
    orderBy: { amount: "desc" },
    include: { charges: { select: { date: true, amount: true, currency: true }, orderBy: { date: "desc" } } },
  });

  // Normalize all money to a single base currency for aggregate math.
  const baseCurrency = await getBaseCurrency();
  const rates = await getRates(baseCurrency);
  const toBase = (amt: number | null, cur: string) => (amt == null ? null : convert(amt, cur, rates));

  const charges = rows.flatMap((r) => r.charges.map((c) => ({ date: c.date, amount: convert(c.amount, c.currency, rates) })));

  const subs: SubLike[] = rows.map((r) => ({
    id: r.id, name: r.name, amount: toBase(r.amount, r.currency), cycle: r.cycle, status: r.status,
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
  const anomalies = detectAnomalies(
    rows.map<SubWithCharges>((r) => ({
      id: r.id, name: r.name, amount: r.amount, status: r.status, cancelledAt: r.cancelledAt, charges: r.charges,
    })),
  );

  const [level, killed, demo] = await Promise.all([
    getAutomationLevel(),
    isKillSwitchOn(),
    isDemoMode(),
  ]);

  const clientSubs = rows.map((r) => ({
    id: r.id, name: r.name, category: r.category, amount: r.amount, currency: r.currency,
    baseAmount: toBase(r.amount, r.currency), // base-currency equiv for sorting/what-if
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
      anomalies={anomalies.map((a) => ({ ...a }))}
      baseCurrency={baseCurrency}
      automationLevel={level}
      killSwitch={killed}
      demoMode={demo}
    />
  );
}
