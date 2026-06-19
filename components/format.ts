import { monthlyAmount } from "@/lib/insights";

export const monthlyEq = monthlyAmount;

export function fmtMoney(n: number | null | undefined, currency = "USD"): string {
  if (n == null) return "—";
  try {
    return n.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function cycleLabel(cycle: string): string {
  return cycle === "unknown" ? "per charge" : `per ${cycle.replace("ly", "")}`.replace("per year", "yearly");
}

export function dueLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.round((d.getTime() - Date.now()) / 86400_000);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (days < 0) return `${date} (overdue)`;
  if (days === 0) return `${date} (today)`;
  return `${date} (${days}d)`;
}
