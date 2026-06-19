import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { merchantKey } from "@/lib/dedupe";

export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.enum(["approve", "reject", "merge"]),
  targetId: z.string().optional(),
});

// Triage a low-confidence detection:
//   approve -> trust it (clear review flag, confidence 1)
//   reject  -> delete it
//   merge   -> fold into another sub + LEARN an alias so future syncs dedupe it
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: "Bad request" }, { status: 400 });
  const { action, targetId } = parsed.data;

  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (action === "approve") {
    await prisma.subscription.update({ where: { id }, data: { reviewNeeded: false, confidence: 1 } });
    return NextResponse.json({ message: `Approved ${sub.name}.` });
  }

  if (action === "reject") {
    await prisma.subscription.delete({ where: { id } });
    return NextResponse.json({ message: `Removed ${sub.name}.` });
  }

  // merge
  if (!targetId) return NextResponse.json({ message: "merge needs a targetId" }, { status: 400 });
  const target = await prisma.subscription.findUnique({ where: { id: targetId } });
  if (!target) return NextResponse.json({ message: "Target not found" }, { status: 404 });

  // Reassign evidence + history to the surviving subscription.
  await prisma.chargeEvent.updateMany({ where: { subscriptionId: id }, data: { subscriptionId: targetId } });
  await prisma.actionLog.updateMany({ where: { subscriptionId: id }, data: { subscriptionId: targetId } });

  // Learn the alias so the next sync folds this variant automatically.
  const key = merchantKey(sub.merchant || sub.name);
  if (key && key !== merchantKey(target.merchant || target.name)) {
    await prisma.merchantAlias.upsert({
      where: { aliasKey: key },
      create: { aliasKey: key, canonical: target.name },
      update: { canonical: target.name },
    });
  }
  await prisma.subscription.delete({ where: { id } });
  return NextResponse.json({ message: `Merged ${sub.name} into ${target.name} and learned the alias.` });
}
