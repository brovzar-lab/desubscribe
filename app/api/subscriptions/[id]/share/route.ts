import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const Body = z.object({ memberIds: z.array(z.string()) });

// Set exactly who a subscription's cost is split across.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: "Bad request" }, { status: 400 });
  await prisma.subscription.update({
    where: { id },
    data: { sharedWith: { set: parsed.data.memberIds.map((mid) => ({ id: mid })) } },
  });
  return NextResponse.json({ message: `Updated sharing (${parsed.data.memberIds.length} member(s)).` });
}
