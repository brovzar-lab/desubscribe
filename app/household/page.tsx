import Link from "next/link";
import { prisma } from "@/lib/db";
import { getBaseCurrency, getRates, convert } from "@/lib/fx";
import { monthlyAmount } from "@/lib/insights";
import { memberTotals, myShare, type ShareableSub } from "@/lib/household";
import HouseholdPanel from "@/components/HouseholdPanel";

export const dynamic = "force-dynamic";

export default async function HouseholdPage() {
  const [members, rows] = await Promise.all([
    prisma.member.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.subscription.findMany({
      where: { status: "active" },
      orderBy: { amount: "desc" },
      include: { sharedWith: { select: { id: true, isSelf: true } } },
    }),
  ]);

  const base = await getBaseCurrency();
  const rates = await getRates(base);

  const shareable: ShareableSub[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    baseMonthly: monthlyAmount(r.amount == null ? null : convert(r.amount, r.currency, rates), r.cycle),
    status: r.status,
    sharedWith: r.sharedWith,
  }));

  const perMember = memberTotals(shareable, members.map((m) => ({ id: m.id, name: m.name, isSelf: m.isSelf })));
  const yourShare = shareable.reduce((sum, s) => sum + myShare(s), 0);
  const totalActive = shareable.reduce((sum, s) => sum + s.baseMonthly, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Household & cost splitting</h1>
        <Link href="/" className="text-sm text-muted hover:text-white">← Dashboard</Link>
      </div>
      <HouseholdPanel
        baseCurrency={base}
        members={members.map((m) => ({ id: m.id, name: m.name, isSelf: m.isSelf, color: m.color }))}
        perMember={perMember}
        yourShare={yourShare}
        totalActive={totalActive}
        subs={rows.map((r) => ({
          id: r.id,
          name: r.name,
          baseMonthly: monthlyAmount(r.amount == null ? null : convert(r.amount, r.currency, rates), r.cycle),
          memberIds: r.sharedWith.map((m) => m.id),
        }))}
      />
    </div>
  );
}
