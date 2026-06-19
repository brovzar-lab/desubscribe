import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const Patch = z.object({
  protected: z.boolean().optional(),
  status: z.enum(["active", "cancelling", "cancelled", "paused"]).optional(),
});

// POST is used as PATCH-lite for simple client fetches.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: "Bad request" }, { status: 400 });

  await prisma.subscription.update({ where: { id }, data: parsed.data });
  const label =
    parsed.data.protected !== undefined
      ? parsed.data.protected
        ? "Protected from auto-cancel."
        : "Protection removed."
      : "Updated.";
  return NextResponse.json({ message: label });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.subscription.delete({ where: { id } });
  return NextResponse.json({ message: "Deleted." });
}
