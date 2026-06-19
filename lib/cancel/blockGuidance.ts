import type { CancelPlan } from "./research";

// When a service makes cancelling hard (phone-only, dark patterns, or the web
// cancel failed), give the user a "cut off their access to your money" fallback.
export function blockGuidance(plan: CancelPlan): string {
  const lines = [
    "If they stonewall the cancellation, stop the charges at the source:",
    "• Use a virtual card (Privacy.com, Capital One Eno, Apple Card per-merchant) and close/pause that card number.",
    "• In your bank/card app, block or lock the merchant if supported.",
    "• File a 'cancel recurring payment' / stop-payment request with your bank (your legal right in many regions).",
    "• If charged after a confirmed cancellation, dispute it as an unauthorized recurring charge.",
  ];
  if (plan.method === "phone" && plan.phone) lines.splice(1, 0, `• Call ${plan.phone} and get a cancellation confirmation number in writing.`);
  return lines.join("\n");
}
