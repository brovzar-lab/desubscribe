import type { BillingCycle } from "./types";

// Normalize any billing cycle to a monthly-equivalent cost.
export function monthlyAmount(amount: number | null | undefined, cycle: string): number {
  if (!amount) return 0;
  switch (cycle as BillingCycle) {
    case "weekly":
      return (amount * 52) / 12;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
    default:
      return amount; // assume monthly when unknown
  }
}

export interface SubLike {
  id: string;
  name: string;
  amount: number | null;
  cycle: string;
  status: string;
  category: string;
  nextDueAt: Date | null;
  lastChargeAt: Date | null;
  isTrial: boolean;
  source: string;
}

export interface Insight {
  kind: "trial_converting" | "duplicate" | "unused" | "pricey";
  subscriptionId: string;
  message: string;
  severity: "info" | "warn" | "bad";
}

// Money-leak detection for the dashboard.
export function computeInsights(subs: SubLike[]): Insight[] {
  const active = subs.filter((s) => s.status === "active");
  const insights: Insight[] = [];
  const now = Date.now();

  for (const s of active) {
    // Trial about to convert within 5 days.
    if (s.isTrial && s.nextDueAt && s.nextDueAt.getTime() - now < 5 * 86400_000) {
      insights.push({
        kind: "trial_converting",
        subscriptionId: s.id,
        message: `${s.name}: free trial converts ${fmtDate(s.nextDueAt)} — cancel now to avoid the charge.`,
        severity: "bad",
      });
    }
    // Unused: no charge in 75+ days but still "active".
    if (s.lastChargeAt && now - s.lastChargeAt.getTime() > 75 * 86400_000) {
      insights.push({
        kind: "unused",
        subscriptionId: s.id,
        message: `${s.name}: no activity since ${fmtDate(s.lastChargeAt)} — possibly unused.`,
        severity: "warn",
      });
    }
    // Pricey: > $30/mo equivalent.
    if (monthlyAmount(s.amount, s.cycle) > 30) {
      insights.push({
        kind: "pricey",
        subscriptionId: s.id,
        message: `${s.name}: ~$${monthlyAmount(s.amount, s.cycle).toFixed(0)}/mo — your priciest tier.`,
        severity: "info",
      });
    }
  }

  // Duplicates within a category (e.g. two music services).
  const byCat = new Map<string, SubLike[]>();
  for (const s of active) {
    if (!byCat.has(s.category)) byCat.set(s.category, []);
    byCat.get(s.category)!.push(s);
  }
  for (const [cat, list] of byCat) {
    if (cat !== "Other" && list.length > 1) {
      insights.push({
        kind: "duplicate",
        subscriptionId: list[0].id,
        message: `${list.length} ${cat} subscriptions (${list.map((l) => l.name).join(", ")}) — overlap you could trim.`,
        severity: "warn",
      });
    }
  }
  return insights;
}

export function totals(subs: SubLike[]) {
  const active = subs.filter((s) => s.status === "active");
  const monthly = active.reduce((sum, s) => sum + monthlyAmount(s.amount, s.cycle), 0);
  return { monthly, yearly: monthly * 12, count: active.length };
}

export function spendByCategory(subs: SubLike[]) {
  const map = new Map<string, number>();
  for (const s of subs.filter((s) => s.status === "active")) {
    map.set(s.category, (map.get(s.category) ?? 0) + monthlyAmount(s.amount, s.cycle));
  }
  return [...map.entries()].map(([category, monthly]) => ({ category, monthly })).sort((a, b) => b.monthly - a.monthly);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
