import type { CancelPlan } from "./research";

// Curated cancel playbooks for big services so we don't need to research every
// time. Matched loosely by name. These are the direct "manage/cancel" entry points.
interface Playbook extends CancelPlan {
  match: RegExp;
  retentionTip?: string; // a "pause/downgrade instead" hint
}

const PLAYBOOKS: Playbook[] = [
  {
    match: /netflix/i,
    method: "web",
    cancelUrl: "https://www.netflix.com/cancelplan",
    steps: ["Sign in", "Account → Membership", "Cancel Membership", "Confirm cancellation"],
    retentionTip: "You can downgrade to a cheaper ad-supported plan instead of cancelling.",
  },
  {
    match: /spotify/i,
    method: "web",
    cancelUrl: "https://www.spotify.com/account/subscription/",
    steps: ["Sign in", "Your plan → Change plan", "Cancel Premium", "Confirm"],
    retentionTip: "Premium reverts to free at period end — you keep playlists.",
  },
  {
    match: /adobe|creative cloud/i,
    method: "web",
    cancelUrl: "https://account.adobe.com/plans",
    steps: ["Sign in", "Manage plan", "Cancel plan", "Note: early-cancel fee may apply on annual plans"],
    retentionTip: "Switch to the annual-paid-monthly or a single-app plan to cut cost.",
  },
  {
    match: /amazon prime|prime membership/i,
    method: "web",
    cancelUrl: "https://www.amazon.com/gp/primecentral",
    steps: ["Sign in", "Prime Membership → End Membership", "Confirm"],
  },
  {
    match: /disney/i,
    method: "web",
    cancelUrl: "https://www.disneyplus.com/account/subscription",
    steps: ["Sign in", "Subscription", "Cancel Subscription", "Confirm"],
  },
  {
    match: /new york times|nytimes|the times/i,
    method: "phone",
    cancelUrl: "https://myaccount.nytimes.com/seg/subscription",
    phone: "1-800-591-9233",
    steps: ["NYT requires chat/phone to cancel", "Open account → cancel, or call", "Confirm cancellation date"],
    retentionTip: "They often offer a 50% retention discount — worth asking before cancelling.",
  },
  {
    match: /hulu/i,
    method: "web",
    cancelUrl: "https://secure.hulu.com/account/cancel",
    steps: ["Sign in", "Account → Cancel", "Confirm"],
  },
  {
    match: /youtube|google one|youtube premium/i,
    method: "web",
    cancelUrl: "https://www.youtube.com/paid_memberships",
    steps: ["Sign in", "Manage membership", "Deactivate / Cancel", "Confirm"],
  },
  {
    match: /apple|icloud|apple music|apple tv/i,
    method: "web",
    cancelUrl: "https://apps.apple.com/account/subscriptions",
    steps: ["Open Apple ID subscriptions", "Select the subscription", "Cancel Subscription", "Confirm"],
  },
  {
    match: /planet fitness|gym|fitness/i,
    method: "phone",
    cancelUrl: null,
    steps: ["Most gyms require in-person or certified-mail cancellation", "Check your home club's policy", "Send written cancellation if required"],
    retentionTip: "Ask about freezing the membership instead of cancelling.",
  },
];

// Return a playbook for a service name, if known.
export function lookupPlaybook(serviceName: string): (CancelPlan & { retentionTip?: string }) | null {
  const pb = PLAYBOOKS.find((p) => p.match.test(serviceName));
  if (!pb) return null;
  const { match, ...plan } = pb;
  void match;
  return plan;
}

export function hasPlaybook(serviceName: string): boolean {
  return PLAYBOOKS.some((p) => p.match.test(serviceName));
}
