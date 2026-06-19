import { prisma } from "@/lib/db";
import { buildIcs, type RenewalItem } from "@/lib/reminders";

export const dynamic = "force-dynamic";

// Download a .ics with all upcoming renewals — importable into any calendar app.
export async function GET() {
  const rows = await prisma.subscription.findMany({
    where: { status: "active", nextDueAt: { not: null } },
    orderBy: { nextDueAt: "asc" },
  });
  const items: RenewalItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    currency: r.currency,
    nextDueAt: r.nextDueAt!,
    isTrial: r.isTrial,
  }));
  const ics = buildIcs(items);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="desubscribe-renewals.ics"',
    },
  });
}
