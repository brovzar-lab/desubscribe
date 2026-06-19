import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { cancelSubscription } from "@/lib/cancel/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  ids: z.array(z.string()).optional(),
  filter: z.enum(["unused", "trials", "selected"]).optional(),
  dryRun: z.boolean().optional(),
});

// Bulk cancel: explicit ids, or a smart filter like "unused" / "trials".
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: "Bad request" }, { status: 400 });
  const { ids, filter, dryRun } = parsed.data;

  let targets: string[] = ids ?? [];
  if (filter === "unused") {
    const cutoff = new Date(Date.now() - 75 * 86400_000);
    const rows = await prisma.subscription.findMany({
      where: { status: "active", protected: false, lastChargeAt: { lt: cutoff } },
      select: { id: true },
    });
    targets = rows.map((r) => r.id);
  } else if (filter === "trials") {
    const soon = new Date(Date.now() + 7 * 86400_000);
    const rows = await prisma.subscription.findMany({
      where: { status: "active", protected: false, isTrial: true, nextDueAt: { lte: soon } },
      select: { id: true },
    });
    targets = rows.map((r) => r.id);
  }

  if (targets.length === 0)
    return NextResponse.json({ message: "Nothing matched — no action taken.", results: [] });

  const results = [];
  for (const id of targets) {
    try {
      results.push(await cancelSubscription(id, { dryRun }));
    } catch (e) {
      results.push({ subscriptionId: id, finalStatus: "failed", steps: [{ type: "error", status: "failed", detail: String(e) }] });
    }
  }
  const ok = results.filter((r) => r.finalStatus === "cancelling" || r.finalStatus === "dry_run").length;
  return NextResponse.json({
    message: `${dryRun ? "Dry-ran" : "Processed"} ${results.length} subscriptions (${ok} actioned).`,
    results,
  });
}
