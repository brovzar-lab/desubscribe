export interface ChargeRow {
  date: Date;
  amount: number;
}

export interface SubWithCharges {
  id: string;
  name: string;
  amount: number | null;
  status: string;
  cancelledAt: Date | null;
  charges: ChargeRow[];
}

export interface Anomaly {
  subscriptionId: string;
  name: string;
  kind: "double_charge" | "post_cancel_charge" | "price_spike";
  message: string;
  severity: "warn" | "bad";
  amount: number;
  date: string; // ISO
}

// Detect billing anomalies from charge history:
//  - double_charge: two+ charges for the same sub within 5 days
//  - post_cancel_charge: a charge dated after the sub was cancelled
//  - price_spike: a charge >1.5× the median of the sub's other charges
export function detectAnomalies(subs: SubWithCharges[]): Anomaly[] {
  const out: Anomaly[] = [];

  for (const s of subs) {
    const charges = [...s.charges].sort((a, b) => +a.date - +b.date);

    // Double charges within a 5-day window.
    for (let i = 1; i < charges.length; i++) {
      const gap = (+charges[i].date - +charges[i - 1].date) / 86400_000;
      if (gap <= 5 && Math.abs(charges[i].amount - charges[i - 1].amount) < 0.01) {
        out.push({
          subscriptionId: s.id,
          name: s.name,
          kind: "double_charge",
          message: `${s.name}: charged ${money(charges[i].amount)} twice within ${Math.round(gap)} day(s) — possible duplicate.`,
          severity: "bad",
          amount: charges[i].amount,
          date: charges[i].date.toISOString(),
        });
      }
    }

    // Charges after cancellation.
    if (s.cancelledAt) {
      for (const c of charges) {
        if (+c.date > +s.cancelledAt + 86400_000) {
          out.push({
            subscriptionId: s.id,
            name: s.name,
            kind: "post_cancel_charge",
            message: `${s.name}: charged ${money(c.amount)} on ${fmt(c.date)} — AFTER you cancelled. Dispute it.`,
            severity: "bad",
            amount: c.amount,
            date: c.date.toISOString(),
          });
        }
      }
    }

    // Price spike vs median.
    if (charges.length >= 3) {
      const amounts = charges.map((c) => c.amount).sort((a, b) => a - b);
      const median = amounts[Math.floor(amounts.length / 2)];
      const latest = charges[charges.length - 1];
      if (median > 0 && latest.amount > median * 1.5) {
        out.push({
          subscriptionId: s.id,
          name: s.name,
          kind: "price_spike",
          message: `${s.name}: latest charge ${money(latest.amount)} is well above its usual ${money(median)}.`,
          severity: "warn",
          amount: latest.amount,
          date: latest.date.toISOString(),
        });
      }
    }
  }

  // Most recent first.
  return out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
