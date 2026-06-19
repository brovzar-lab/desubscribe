import { NextResponse } from "next/server";
import { simpleParser } from "mailparser";
import { parseUnsubscribe } from "@/lib/email/unsubscribe";
import { ingestEmail } from "@/lib/ingest";
import { headerVal } from "@/lib/email/headers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Real-time receipt capture. Point an email-forwarding service here (set up a
// forwarding address that POSTs inbound mail), e.g. SendGrid Inbound Parse or
// Mailgun routes. Protect with ?token= matching INBOUND_TOKEN.
// Accepts: SendGrid/Mailgun form-encoded, raw RFC822, or JSON {from,subject,text}.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.INBOUND_TOKEN;
  if (secret && url.searchParams.get("token") !== secret)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const ct = req.headers.get("content-type") || "";
  let from = "", subject = "", text = "";
  let unsub = parseUnsubscribe({ listUnsubscribe: null, listUnsubscribePost: null });

  try {
    if (ct.includes("application/json")) {
      const b = await req.json();
      ({ from = "", subject = "", text = "" } = b);
    } else if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      const get = (...keys: string[]) => keys.map((k) => form.get(k)).find((v) => typeof v === "string") as string | undefined;
      // If the service forwards the full MIME, parse that for best fidelity.
      const rawMime = get("email", "message-headers", "body-mime");
      if (rawMime) return await ingestRaw(rawMime);
      from = get("from", "From", "sender") ?? "";
      subject = get("subject", "Subject") ?? "";
      text = get("text", "body-plain", "stripped-text", "plain") ?? "";
    } else {
      return await ingestRaw(await req.text());
    }
  } catch (e) {
    return NextResponse.json({ message: "Parse error: " + String(e) }, { status: 400 });
  }

  const r = await ingestEmail({ from, subject, text, unsub });
  // Webhooks expect 2xx even when we choose not to act, so the sender doesn't retry.
  return NextResponse.json({ message: r.message, id: r.id });
}

async function ingestRaw(raw: string) {
  if (!raw?.trim()) return NextResponse.json({ message: "Empty body" }, { status: 400 });
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
  return NextResponse.json({ message: r.message, id: r.id });
}
