import { NextResponse } from "next/server";
import { buildDigest, sendDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET = preview the digest (no send). POST = build and email it.
export async function GET() {
  const digest = await buildDigest();
  return NextResponse.json(digest);
}

export async function POST() {
  const r = await sendDigest();
  return NextResponse.json({ message: r.message }, { status: r.ok ? 200 : 400 });
}
