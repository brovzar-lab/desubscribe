import { NextResponse } from "next/server";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/db";
import { extractFromEmail } from "@/lib/email/extract";
import { parseUnsubscribe } from "@/lib/email/unsubscribe";
import { sameService } from "@/lib/dedupe";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Capture a single receipt without a full inbox scan. Accepts either:
//   - text/plain raw RFC822 email (forwarded), or
//   - application/json { from, subject, text }
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  let email = { from: "", subject: "", date: new Date().toISOString(), text: "" };
  let unsub = parseUnsubscribe({ listUnsubscribe: null, listUnsubscribePost: null });

  if (ct.includes("application/json")) {
    const b = await req.json();
    email = { from: b.from ?? "", subject: b.subject ?? "", date: b.date ?? new Date().toISOString(), text: b.text ?? "" };
  } else {
    const raw = await req.text();
    if (!raw.trim()) return NextResponse.json({ message: "Empty body" }, { status: 400 });
    const parsed = await simpleParser(raw);
    email = {
      from: parsed.from?.text ?? "",
      subject: parsed.subject ?? "",
      date: (parsed.date ?? new Date()).toISOString(),
      text: (parsed.text ?? parsed.html ?? raw).toString().slice(0, 8000),
    };
    const lu = parsed.headers.get("list-unsubscribe");
    const lup = parsed.headers.get("list-unsubscribe-post");
    unsub = parseUnsubscribe({
      listUnsubscribe: typeof lu === "string" ? lu : lu ? String((lu as { value?: unknown }).value ?? lu) : null,
      listUnsubscribePost: typeof lup === "string" ? lup : lup ? String((lup as { value?: unknown }).value ?? lup) : null,
    });
  }

  if (!email.text && !email.subject)
    return NextResponse.json({ message: "Provide an email (raw, or from/subject/text)." }, { status: 400 });

  const sub = await extractFromEmail(email);
  if (!sub) return NextResponse.json({ message: "That didn't look like a subscription/receipt." }, { status: 422 });

  const data = {
    name: sub.name,
    merchant: sub.merchant ?? sub.name,
    category: sub.category ?? "Other",
    amount: sub.amount ?? null,
    currency: sub.currency ?? "USD",
    cycle: sub.cycle ?? "unknown",
    nextDueAt: sub.nextDueAt ? new Date(sub.nextDueAt) : null,
    isTrial: sub.isTrial ?? false,
    cancelUrl: sub.cancelUrl ?? unsub.httpsUrl ?? null,
    unsubData: JSON.stringify(unsub),
    confidence: sub.confidence ?? 0.6,
    source: "email",
  };

  const existing = (await prisma.subscription.findMany()).find((e) => sameService(e.merchant || e.name, data.merchant));
  if (existing) {
    await prisma.subscription.update({ where: { id: existing.id }, data });
    return NextResponse.json({ message: `Updated ${data.name} from the receipt.`, id: existing.id });
  }
  const created = await prisma.subscription.create({ data: { ...data, firstSeenAt: new Date() } });
  return NextResponse.json({ message: `Captured ${data.name} from the receipt.`, id: created.id });
}
