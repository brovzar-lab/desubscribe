import Papa from "papaparse";
import { prisma } from "@/lib/db";
import { monthlyAmount } from "@/lib/insights";

export const dynamic = "force-dynamic";

// Export all subscriptions as a CSV report.
export async function GET() {
  const subs = await prisma.subscription.findMany({ orderBy: { amount: "desc" } });
  const rows = subs.map((s) => ({
    name: s.name,
    category: s.category,
    amount: s.amount ?? "",
    currency: s.currency,
    cycle: s.cycle,
    monthly_equivalent: monthlyAmount(s.amount, s.cycle).toFixed(2),
    next_due: s.nextDueAt?.toISOString().slice(0, 10) ?? "",
    status: s.status,
    source: s.source,
    confidence: Math.round(s.confidence * 100) + "%",
    is_trial: s.isTrial ? "yes" : "no",
    protected: s.protected ? "yes" : "no",
    cancel_url: s.cancelUrl ?? "",
  }));
  const csv = Papa.unparse(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="desubscribe-report.csv"',
    },
  });
}
