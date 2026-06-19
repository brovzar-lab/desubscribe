import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { decrypt } from "../crypto";
import { parseUnsubscribe } from "./unsubscribe";
import type { RawEmail } from "./extract";
import type { UnsubInfo } from "../types";

interface AccountCreds {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

export function credsFromAccount(a: {
  email: string;
  imapHost: string | null;
  imapPort: number;
  smtpHost: string | null;
  smtpPort: number;
  secretCipher: string | null;
}): AccountCreds {
  if (!a.imapHost || !a.smtpHost || !a.secretCipher)
    throw new Error(`Account ${a.email} is missing IMAP credentials`);
  return {
    email: a.email,
    imapHost: a.imapHost,
    imapPort: a.imapPort,
    smtpHost: a.smtpHost,
    smtpPort: a.smtpPort,
    password: decrypt(a.secretCipher),
  };
}

// Common-provider defaults so the user only needs an email + app-password.
export function providerDefaults(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (/gmail|googlemail/.test(domain))
    return { imapHost: "imap.gmail.com", imapPort: 993, smtpHost: "smtp.gmail.com", smtpPort: 465 };
  if (/outlook|hotmail|live|office365/.test(domain))
    return { imapHost: "outlook.office365.com", imapPort: 993, smtpHost: "smtp.office365.com", smtpPort: 587 };
  if (/yahoo/.test(domain))
    return { imapHost: "imap.mail.yahoo.com", imapPort: 993, smtpHost: "smtp.mail.yahoo.com", smtpPort: 465 };
  if (/icloud|me\.com/.test(domain))
    return { imapHost: "imap.mail.me.com", imapPort: 993, smtpHost: "smtp.mail.me.com", smtpPort: 587 };
  return { imapHost: `imap.${domain}`, imapPort: 993, smtpHost: `smtp.${domain}`, smtpPort: 465 };
}

export interface FetchedEmail extends RawEmail {
  unsub: UnsubInfo;
}

// Pull likely-subscription emails from the last `sinceDays`. Searches subject
// keywords to keep volume sane, then parses bodies + List-Unsubscribe headers.
export async function fetchSubscriptionEmails(
  creds: AccountCreds,
  opts: { sinceDays?: number; max?: number } = {},
): Promise<FetchedEmail[]> {
  const sinceDays = opts.sinceDays ?? 365;
  const max = opts.max ?? 200;
  const client = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: true,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
  });

  const out: FetchedEmail[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - sinceDays * 86400_000);
      // IMAP OR-tree across the billing keywords.
      const keywords = ["receipt", "invoice", "subscription", "renew", "payment", "trial", "unsubscribe"];
      const uids = await searchAny(client, keywords, since);
      const take = uids.slice(-max);
      for await (const msg of client.fetch(take, { source: true, uid: true })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
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
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return out;
}

async function searchAny(client: ImapFlow, keywords: string[], since: Date): Promise<number[]> {
  const seen = new Set<number>();
  for (const kw of keywords) {
    const ids = (await client.search({ since, subject: kw }, { uid: true })) || [];
    for (const id of ids as number[]) seen.add(id);
  }
  return [...seen].sort((a, b) => a - b);
}

function headerVal(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(", ");
  // mailparser may give a structured object
  return String((v as { value?: unknown }).value ?? v);
}

// Send an unsubscribe / cancellation email via the account's SMTP.
export async function sendMail(
  creds: AccountCreds,
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; info: string }> {
  const transport = nodemailer.createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: creds.smtpPort === 465,
    auth: { user: creds.email, pass: creds.password },
  });
  const info = await transport.sendMail({ from: creds.email, to, subject, text: body });
  return { ok: true, info: info.messageId };
}
