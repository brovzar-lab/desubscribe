import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { researchCancellation } from "@/lib/cancel/research";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Preview the cancellation plan (playbook / AI-researched) without acting.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const plan = await researchCancellation(sub.name);
  return NextResponse.json({ plan });
}
