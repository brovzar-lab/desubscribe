import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { draftRetention } from "@/lib/retention";
import { credsFromAccount, sendMail } from "@/lib/email/imap";
import { sendGmail } from "@/lib/email/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET = draft a retention message. POST = also create a Gmail draft (if connected),
// or send it to a provided recipient when ?send=1.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const draft = await draftRetention(sub);
  return NextResponse.json({ draft });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const draft = await draftRetention(sub);
  const account = await prisma.emailAccount.findFirst();
  if (!account)
    return NextResponse.json({ message: "Connect an email account to send/draft.", draft }, { status: 400 });

  try {
    if (to) {
      const r =
        account.authType === "gmail_oauth" && account.oauthCipher
          ? await sendGmail(account.oauthCipher, account.email, to, draft.subject, draft.body)
          : await sendMail(credsFromAccount(account), to, draft.subject, draft.body);
      await log(id, "retention_sent", `Sent ${draft.strategy} message to ${to}`);
      return NextResponse.json({ message: `Sent retention message to ${to}.`, draft, info: r.info });
    }
    // No recipient: leave it as a Gmail draft for review (OAuth accounts only).
    if (account.authType === "gmail_oauth" && account.oauthCipher) {
      await sendGmail(account.oauthCipher, account.email, account.email, `[DRAFT] ${draft.subject}`, draft.body);
      await log(id, "retention_draft", `Drafted ${draft.strategy} message`);
      return NextResponse.json({ message: "Saved a draft to your mailbox for review.", draft });
    }
    return NextResponse.json({ message: "Drafted (provide ?to=email to send).", draft });
  } catch (e) {
    return NextResponse.json({ message: "Failed: " + String(e), draft }, { status: 500 });
  }
}

async function log(subscriptionId: string, type: string, detail: string) {
  await prisma.actionLog.create({ data: { subscriptionId, type, status: "success", detail } });
}
