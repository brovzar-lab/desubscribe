import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const accounts = await prisma.emailAccount.count();
  const banks = await prisma.bankItem.count();
  if (accounts === 0 && banks === 0) {
    return NextResponse.json({
      message: "Nothing connected yet — add a mailbox or bank in Settings. (Demo data shown meanwhile.)",
      added: 0,
      updated: 0,
    });
  }
  try {
    const r = await runSync();
    return NextResponse.json({
      message: `Sync done: ${r.added} new, ${r.updated} updated from ${r.scanned} signals.`,
      ...r,
    });
  } catch (e) {
    return NextResponse.json({ message: "Sync failed: " + String(e) }, { status: 500 });
  }
}
