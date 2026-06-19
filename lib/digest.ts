import { prisma } from "./db";
import { computeInsights, totals, type SubLike } from "./insights";
import { savings, healthScore } from "./analytics";
import { detectAnomalies, type SubWithCharges } from "./anomalies";
import { credsFromAccount, sendMail } from "./email/imap";
import { sendGmail } from "./email/gmail";
import { getSetting } from "./settings";

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export interface Digest {
  subject: string;
  text: string;
  html: string;
}

// Build a weekly summary: spend, upcoming renewals, leaks, anomalies, savings.
export async function buildDigest(): Promise<Digest> {
  const rows = await prisma.subscription.findMany({
    include: { charges: { select: { date: true, amount: true } } },
  });
  const subs: SubLike[] = rows.map((r) => ({
    id: r.id, name: r.name, amount: r.amount, cycle: r.cycle, status: r.status,
    category: r.category, nextDueAt: r.nextDueAt, lastChargeAt: r.lastChargeAt,
    isTrial: r.isTrial, source: r.source,
  }));

  const t = totals(subs);
  const insights = computeInsights(subs);
  const save = savings(rows.map((r) => ({ ...subs.find((s) => s.id === r.id)!, cancelledAt: r.cancelledAt })));
  const health = healthScore(subs, {
    trial: insights.filter((i) => i.kind === "trial_converting").length,
    unused: insights.filter((i) => i.kind === "unused").length,
    duplicate: insights.filter((i) => i.kind === "duplicate").length,
  });
  const anomalies = detectAnomalies(
    rows.map<SubWithCharges>((r) => ({
      id: r.id, name: r.name, amount: r.amount, status: r.status, cancelledAt: r.cancelledAt, charges: r.charges,
    })),
  );

  const soon = new Date(Date.now() + 14 * 86400_000);
  const upcoming = subs
    .filter((s) => s.status === "active" && s.nextDueAt && s.nextDueAt <= soon)
    .sort((a, b) => +a.nextDueAt! - +b.nextDueAt!);

  const lines: string[] = [];
  lines.push(`Your Desubscribe weekly digest`, ``);
  lines.push(`Spend: ${money(t.monthly)}/mo (${money(t.yearly)}/yr) across ${t.count} active subs · Health ${health.grade} (${health.score})`);
  lines.push(`Saved so far: ${money(save.annualized)}/yr from ${save.count} cancellations`, ``);

  if (upcoming.length) {
    lines.push(`Renewing in the next 14 days:`);
    for (const s of upcoming) lines.push(`  • ${s.name} — ${money(s.amount ?? 0)} on ${s.nextDueAt!.toLocaleDateString()}`);
    lines.push(``);
  }
  if (anomalies.length) {
    lines.push(`⚠ Anomalies to check:`);
    for (const a of anomalies.slice(0, 8)) lines.push(`  • ${a.message}`);
    lines.push(``);
  }
  if (insights.length) {
    lines.push(`Money-leak insights:`);
    for (const i of insights.slice(0, 10)) lines.push(`  • ${i.message}`);
    lines.push(``);
  }
  lines.push(`Open the dashboard to act: ${process.env.APP_URL || "http://localhost:3000"}`);

  const text = lines.join("\n");
  const html = `<pre style="font:14px/1.5 ui-monospace,monospace">${escapeHtml(text)}</pre>`;
  return {
    subject: `Desubscribe: ${money(t.monthly)}/mo · ${upcoming.length} renewing · ${anomalies.length} anomalies`,
    text,
    html,
  };
}

// Send the digest to the configured recipient (Setting digestEmail) or the first
// connected mailbox's own address.
export async function sendDigest(): Promise<{ ok: boolean; to: string | null; message: string }> {
  const account = await prisma.emailAccount.findFirst();
  if (!account) return { ok: false, to: null, message: "No email account connected." };
  const to = (await getSetting("digestEmail")) || account.email;
  const digest = await buildDigest();

  try {
    if (account.authType === "gmail_oauth" && account.oauthCipher) {
      await sendGmail(account.oauthCipher, account.email, to, digest.subject, digest.text);
    } else {
      await sendMail(credsFromAccount(account), to, digest.subject, digest.text);
    }
    await prisma.actionLog.create({ data: { type: "digest", status: "success", detail: `Sent weekly digest to ${to}` } });
    return { ok: true, to, message: `Digest sent to ${to}.` };
  } catch (e) {
    return { ok: false, to, message: "Send failed: " + String(e) };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}
