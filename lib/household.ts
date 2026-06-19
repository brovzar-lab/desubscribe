import { monthlyAmount } from "./insights";

export interface ShareableSub {
  id: string;
  name: string;
  baseMonthly: number; // already converted to base currency, monthly-equivalent
  status: string;
  sharedWith: { id: string; isSelf: boolean }[];
}

// Your monthly share of a subscription: full cost if it's unshared, otherwise an
// equal split across everyone it's shared with (only counted if you're included).
export function myShare(sub: ShareableSub): number {
  if (sub.status !== "active") return 0;
  const n = sub.sharedWith.length;
  if (n === 0) return sub.baseMonthly; // unshared = all yours
  const includesSelf = sub.sharedWith.some((m) => m.isSelf);
  return includesSelf ? sub.baseMonthly / n : 0; // shared but not with you = $0 to you
}

// Per-member monthly totals across all active subs.
export function memberTotals(
  subs: ShareableSub[],
  members: { id: string; name: string; isSelf: boolean }[],
): { id: string; name: string; isSelf: boolean; monthly: number }[] {
  const totals = new Map<string, number>();
  for (const s of subs) {
    if (s.status !== "active" || s.sharedWith.length === 0) continue;
    const split = s.baseMonthly / s.sharedWith.length;
    for (const m of s.sharedWith) totals.set(m.id, (totals.get(m.id) ?? 0) + split);
  }
  return members.map((m) => ({ ...m, monthly: totals.get(m.id) ?? 0 }));
}

// Convenience: build baseMonthly from amount/cycle (for callers that have raw fields).
export function toBaseMonthly(amount: number | null, cycle: string): number {
  return monthlyAmount(amount, cycle);
}
