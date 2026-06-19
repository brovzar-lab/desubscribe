import { NextResponse } from "next/server";
import { simpleParser } from "mailparser";
import { parseUnsubscribe } from "@/lib/email/unsubscribe";
import { ingestEmail } from "@/lib/ingest";
import { headerVal } from "@/lib/email/headers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Capture a single receipt without a full inbox scan. Accepts either:
//   - text/plain raw RFC822 email (forwarded), or
//   - application/json { from, subject, text }
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    const b = await req.json();
    const r = await ingestEmail({ from: b.from ?? "", subject: b.subject ?? "", text: b.text ?? "", date: b.date });
    return NextResponse.json({ message: r.message, id: r.id }, { status: r.ok ? 200 : 422 });
  }

  const raw = await req.text();
  if (!raw.trim()) return NextResponse.json({ message: "Empty body" }, { status: 400 });
  const parsed = await simpleParser(raw);
  const unsub = parseUnsubscribe({
    listUnsubscribe: headerVal(parsed.headers.get("list-unsubscribe")),
    listUnsubscribePost: headerVal(parsed.headers.get("list-unsubscribe-post")),
  });
  const r = await ingestEmail({
    from: parsed.from?.text ?? "",
    subject: parsed.subject ?? "",
    date: (parsed.date ?? new Date()).toISOString(),
    text: (parsed.text ?? parsed.html ?? raw).toString().slice(0, 8000),
    unsub,
  });
  return NextResponse.json({ message: r.message, id: r.id }, { status: r.ok ? 200 : 422 });
}
