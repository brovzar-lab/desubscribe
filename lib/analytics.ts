import { monthlyAmount, type SubLike } from "./insights";

// Total money saved from cancellations: monthly-equivalent of cancelled subs,
// annualized. Optionally weighted by how long since cancellation.
export function savings(subs: (SubLike & { cancelledAt: Date | null })[]) {
  const cancelled = subs.filter((s) => s.status === "cancelled" || s.status === "cancelling");
  const monthly = cancelled.reduce((sum, s) => sum + monthlyAmount(s.amount, s.cycle), 0);
  // Realized = months elapsed since cancellation × monthly.
  let realized = 0;
  const now = Date.now();
  for (const s of cancelled) {
    if (!s.cancelledAt) continue;
    const months = Math.max(0, (now - s.cancelledAt.getTime()) / (30 * 86400_000));
    realized += monthlyAmount(s.amount, s.cycle) * months;
  }
  return { monthly, annualized: monthly * 12, realized, count: cancelled.length };
}

// A 0–100 "subscription health" score. Lower spend-concentration, fewer leaks,
// fewer unknown-confidence subs, and protection of essentials → higher score.
export function healthScore(
  subs: SubLike[],
  insightsCount: { trial: number; unused: number; duplicate: number },
): { score: number; grade: string; reasons: string[] } {
  const active = subs.filter((s) => s.status === "active");
  let score = 100;
  const reasons: string[] = [];

  const monthly = active.reduce((s, x) => s + monthlyAmount(x.amount, x.cycle), 0);
  if (monthly > 200) { score -= 20; reasons.push(`High spend ($${monthly.toFixed(0)}/mo)`); }
  else if (monthly > 100) { score -= 10; reasons.push(`Moderate spend ($${monthly.toFixed(0)}/mo)`); }

  score -= insightsCount.unused * 8;
  if (insightsCount.unused) reasons.push(`${insightsCount.unused} possibly-unused subs`);
  score -= insightsCount.trial * 10;
  if (insightsCount.trial) reasons.push(`${insightsCount.trial} trial(s) about to convert`);
  score -= insightsCount.duplicate * 6;
  if (insightsCount.duplicate) reasons.push(`${insightsCount.duplicate} duplicate categories`);

  const lowConf = active.filter((s) => s.amount == null).length;
  score -= lowConf * 3;
  if (lowConf) reasons.push(`${lowConf} subs missing an amount`);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  if (reasons.length === 0) reasons.push("Lean and well-managed");
  return { score, grade, reasons };
}

// Monthly spend history from charge events (last `months` buckets).
export function spendTrend(
  charges: { date: Date; amount: number }[],
  months = 6,
): { month: string; total: number }[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(key(d), 0);
  }
  for (const c of charges) {
    const k = key(c.date);
    if (buckets.has(k)) buckets.set(k, buckets.get(k)! + Math.abs(c.amount));
  }
  return [...buckets.entries()].map(([month, total]) => ({ month, total }));
}

function key(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}
