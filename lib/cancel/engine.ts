import { prisma } from "../db";
import { getAutomationLevel, isKillSwitchOn } from "../settings";
import { credsFromAccount, sendMail } from "../email/imap";
import { oneClickUnsubscribe } from "../email/unsubscribe";
import { researchCancellation } from "./research";
import { webCancel } from "./webCancel";
import type { UnsubInfo } from "../types";

interface CancelResult {
  subscriptionId: string;
  steps: { type: string; status: string; detail: string }[];
  finalStatus: string;
}

// Full-auto cancel pipeline with safety gates:
//   kill-switch / protected / dry-run -> escalate one_click -> email_unsub -> web_cancel.
// Every attempt is written to ActionLog.
export async function cancelSubscription(
  subscriptionId: string,
  opts: { dryRun?: boolean } = {},
): Promise<CancelResult> {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new Error("Subscription not found");

  const steps: CancelResult["steps"] = [];
  const dryRun = opts.dryRun ?? false;
  const level = await getAutomationLevel();
  const killed = await isKillSwitchOn();

  const confirmOver = Number(process.env.AUTO_CANCEL_CONFIRM_OVER || "0");
  const needsConfirm = confirmOver > 0 && (sub.amount ?? 0) > confirmOver;

  // Safety gates --------------------------------------------------------------
  if (sub.protected) return finish(sub.id, "skipped", steps, "Subscription is protected — not cancelling.");
  if (killed) return finish(sub.id, "skipped", steps, "Global kill-switch is ON.");
  if (level === "draft_only" && !dryRun)
    return finish(sub.id, "draft", steps, "Automation level is draft-only; prepared a plan instead of executing.");
  if (needsConfirm && !dryRun)
    return finish(sub.id, "needs_confirm", steps, `Costs $${sub.amount} (> $${confirmOver}); confirm before auto-cancel.`);

  const unsub: UnsubInfo | null = sub.unsubData ? JSON.parse(sub.unsubData) : null;

  // 1) One-click unsubscribe (best for marketing / list email) ----------------
  if (unsub?.oneClick && unsub.httpsUrl) {
    if (dryRun) {
      steps.push({ type: "one_click", status: "dry_run", detail: `Would POST one-click unsubscribe to ${unsub.httpsUrl}` });
    } else {
      const r = await oneClickUnsubscribe(unsub.httpsUrl).catch((e) => ({ ok: false, status: 0, body: String(e) }));
      await log(sub.id, "one_click", r.ok ? "success" : "failed", `One-click unsubscribe (${r.status})`, { url: unsub.httpsUrl }, r);
      steps.push({ type: "one_click", status: r.ok ? "success" : "failed", detail: `One-click unsubscribe → HTTP ${r.status}` });
      if (r.ok && level === "auto_marketing")
        return finish(sub.id, "cancelled", steps, "Unsubscribed via one-click.");
    }
  }

  // 2) Email unsubscribe / cancellation request -------------------------------
  const account = await prisma.emailAccount.findFirst();
  const mailTarget = unsub?.mailto || null;
  if (mailTarget && account) {
    if (dryRun) {
      steps.push({ type: "email_unsub", status: "dry_run", detail: `Would email unsubscribe request to ${mailTarget}` });
    } else {
      const creds = credsFromAccount(account);
      const r = await sendMail(creds, mailTarget, "Unsubscribe", `Please unsubscribe ${creds.email} and cancel any associated subscription.`).catch(
        (e) => ({ ok: false, info: String(e) }),
      );
      await log(sub.id, "email_unsub", r.ok ? "success" : "failed", `Emailed unsubscribe to ${mailTarget}`, { to: mailTarget }, r);
      steps.push({ type: "email_unsub", status: r.ok ? "success" : "failed", detail: `Emailed unsubscribe → ${mailTarget}` });
    }
  }

  // 3) Web cancel (paid services): research the page, then drive it -----------
  const plan = await researchCancellation(sub.name);
  const cancelUrl = sub.cancelUrl || plan.cancelUrl;
  if (cancelUrl) {
    if (dryRun) {
      steps.push({ type: "web_cancel", status: "dry_run", detail: `Would open ${cancelUrl} and follow: ${plan.steps.join(" → ")}` });
    } else {
      const r = await webCancel(cancelUrl, sub.name);
      await log(sub.id, "web_cancel", r.ok ? "success" : "failed", r.detail, { cancelUrl, plan }, r, r.screenshotPath);
      steps.push({ type: "web_cancel", status: r.ok ? "success" : "failed", detail: r.detail });
    }
  } else if (!mailTarget) {
    steps.push({ type: "web_cancel", status: "failed", detail: `No cancel URL found. Plan: ${plan.steps.join(" → ")}` });
  }

  const anySuccess = steps.some((s) => s.status === "success");
  const finalStatus = dryRun ? "dry_run" : anySuccess ? "cancelling" : "failed";
  if (!dryRun) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: anySuccess ? "cancelling" : sub.status },
    });
  }
  return { subscriptionId: sub.id, steps, finalStatus };
}

async function finish(id: string, status: string, steps: CancelResult["steps"], detail: string): Promise<CancelResult> {
  await log(id, "draft", status, detail);
  steps.push({ type: "gate", status, detail });
  return { subscriptionId: id, steps, finalStatus: status };
}

async function log(
  subscriptionId: string,
  type: string,
  status: string,
  detail: string,
  request?: unknown,
  response?: unknown,
  screenshotPath?: string | null,
) {
  await prisma.actionLog.create({
    data: {
      subscriptionId,
      type,
      status,
      detail,
      request: request ? JSON.stringify(request) : null,
      response: response ? JSON.stringify(response) : null,
      screenshotPath: screenshotPath ?? null,
    },
  });
}
