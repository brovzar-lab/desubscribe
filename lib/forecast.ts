import { monthlyAmount } from "./insights";

export interface ForecastSub {
  amount: number | null; // already in base currency
  cycle: string;
  status: string;
  nextDueAt: Date | null;
}

export interface ForecastPoint {
  month: string; // "Jul 26"
  projected: number;
}

// Project spend for the next `months` months. Monthly/weekly subs contribute
// their monthly-equivalent every month; quarterly/yearly subs land as LUMPS on
// the actual billing months (so annual renewals show up as spikes you can plan for).
export function forecast(subs: ForecastSub[], months = 12): ForecastPoint[] {
  const now = new Date();
  const points: ForecastPoint[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    points.push({ month: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), projected: 0 });
  }

  const monthIndex = (date: Date) =>
    (date.getFullYear() - now.getFullYear()) * 12 + (date.getMonth() - now.getMonth());

  for (const s of subs) {
    if (s.status !== "active" || !s.amount) continue;
    const cycle = s.cycle;

    if (cycle === "monthly" || cycle === "weekly" || cycle === "unknown") {
      const m = monthlyAmount(s.amount, cycle);
      for (const p of points) p.projected += m;
      continue;
    }

    // Lumpy cycles: step from the next due date by the cycle interval.
    const step = cycle === "quarterly" ? 3 : 12;
    let cursor = s.nextDueAt ? new Date(s.nextDueAt) : new Date(now.getFullYear(), now.getMonth(), 1);
    // Roll forward to the first due date that's >= now.
    while (monthIndex(cursor) < 0) cursor = new Date(cursor.getFullYear(), cursor.getMonth() + step, cursor.getDate());
    while (monthIndex(cursor) < months) {
      const idx = monthIndex(cursor);
      if (idx >= 0 && idx < months) points[idx].projected += s.amount;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + step, cursor.getDate());
    }
  }

  for (const p of points) p.projected = Math.round(p.projected * 100) / 100;
  return points;
}

export function forecastTotal(points: ForecastPoint[]): number {
  return points.reduce((s, p) => s + p.projected, 0);
}
