import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1),
  amount: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  cycle: z.enum(["weekly", "monthly", "quarterly", "yearly", "unknown"]).optional(),
  category: z.string().optional(),
  nextDueAt: z.string().optional(),
  cancelUrl: z.string().optional(),
  isTrial: z.boolean().optional(),
});

// Manually add a subscription.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid input" }, { status: 400 });
  const d = parsed.data;
  const sub = await prisma.subscription.create({
    data: {
      name: d.name,
      merchant: d.name,
      amount: d.amount ?? null,
      currency: d.currency ?? "USD",
      cycle: d.cycle ?? "monthly",
      category: d.category ?? "Other",
      nextDueAt: d.nextDueAt ? new Date(d.nextDueAt) : null,
      cancelUrl: d.cancelUrl ?? null,
      isTrial: d.isTrial ?? false,
      source: "manual",
      confidence: 1,
      firstSeenAt: new Date(),
    },
  });
  return NextResponse.json({ message: `Added ${d.name}.`, id: sub.id });
}

export async function GET() {
  const subs = await prisma.subscription.findMany({ orderBy: { amount: "desc" } });
  return NextResponse.json({ subs });
}
