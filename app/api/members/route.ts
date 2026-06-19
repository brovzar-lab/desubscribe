import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PALETTE = ["#6d8bff", "#3ecf8e", "#f5a623", "#ff5d6c", "#a78bfa", "#22d3ee", "#f472b6"];

const Body = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  isSelf: z.boolean().optional(),
});

export async function GET() {
  const members = await prisma.member.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ members });
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: "Invalid member" }, { status: 400 });
  const count = await prisma.member.count();
  // Only one "self".
  if (parsed.data.isSelf) await prisma.member.updateMany({ data: { isSelf: false } });
  const m = await prisma.member.create({
    data: { ...parsed.data, color: PALETTE[count % PALETTE.length] },
  });
  return NextResponse.json({ message: `Added ${m.name}.`, id: m.id });
}
