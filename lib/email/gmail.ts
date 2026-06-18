import { google } from "googleapis";
import { simpleParser } from "mailparser";
import { clientFromCipher } from "../google";
import { parseUnsubscribe } from "./unsubscribe";
import type { FetchedEmail } from "./imap";

// Pull likely-subscription emails through the Gmail API (OAuth accounts).
// Mirrors fetchSubscriptionEmails() so the sync orchestrator treats them alike.
export async function fetchGmailSubscriptionEmails(
  oauthCipher: string,
  opts: { sinceDays?: number; max?: number } = {},
): Promise<FetchedEmail[]> {
  const sinceDays = opts.sinceDays ?? 365;
  const max = opts.max ?? 150;
  const auth = clientFromCipher(oauthCipher);
  const gmail = google.gmail({ version: "v1", auth });

  const after = Math.floor((Date.now() - sinceDays * 86400_000) / 1000);
  const q = `(receipt OR invoice OR subscription OR renew OR payment OR trial OR unsubscribe) after:${after}`;
  const list = await gmail.users.messages.list({ userId: "me", q, maxResults: max });
  const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);

  const out: FetchedEmail[] = [];
  for (const id of ids) {
    const msg = await gmail.users.messages.get({ userId: "me", id, format: "raw" });
    const raw = msg.data.raw;
    if (!raw) continue;
    const parsed = await simpleParser(Buffer.from(raw, "base64url"));
    const unsub = parseUnsubscribe({
      listUnsubscribe: headerVal(parsed.headers.get("list-unsubscribe")),
      listUnsubscribePost: headerVal(parsed.headers.get("list-unsubscribe-post")),
    });
    out.push({
      from: parsed.from?.text ?? "",
      subject: parsed.subject ?? "",
      date: (parsed.date ?? new Date()).toISOString(),
      text: (parsed.text ?? parsed.html ?? "").toString().slice(0, 8000),
      unsub,
    });
  }
  return out;
}

// Send an unsubscribe/cancel email via the Gmail API.
export async function sendGmail(
  oauthCipher: string,
  from: string,
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; info: string }> {
  const auth = clientFromCipher(oauthCipher);
  const gmail = google.gmail({ version: "v1", auth });
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");
  const raw = Buffer.from(mime).toString("base64url");
  const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return { ok: true, info: res.data.id || "sent" };
}

function headerVal(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(", ");
  return String((v as { value?: unknown }).value ?? v);
}
