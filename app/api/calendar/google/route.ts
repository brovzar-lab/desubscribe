import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pushToGoogleCalendar, type RenewalItem } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Push upcoming renewals into Google Calendar (uses the first OAuth mailbox).
export async function POST() {
  const account = await prisma.emailAccount.findFirst({
    where: { authType: "gmail_oauth", oauthCipher: { not: null } },
  });
  if (!account?.oauthCipher)
    return NextResponse.json({ message: "Connect a Google account (Settings) to push reminders." }, { status: 400 });

  const rows = await prisma.subscription.findMany({
    where: { status: "active", nextDueAt: { not: null } },
    orderBy: { nextDueAt: "asc" },
  });
  const items: RenewalItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    currency: r.currency,
    nextDueAt: r.nextDueAt!,
    isTrial: r.isTrial,
  }));
  try {
    const { created } = await pushToGoogleCalendar(account.oauthCipher, items);
    await prisma.actionLog.create({
      data: { type: "sync", status: "success", detail: `Added ${created} renewal reminders to Google Calendar.` },
    });
    return NextResponse.json({ message: `Added ${created} reminders to Google Calendar.` });
  } catch (e) {
    return NextResponse.json({ message: "Calendar push failed: " + String(e) }, { status: 500 });
  }
}
