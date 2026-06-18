# Desubscribe — Tester findings & engineering roadmap

I used the app as a tester trying to kill my own subscriptions, found the gaps, then
engineered fixes + new features. This is the running record.

## 🧪 Tester pass — gaps I hit (and fixed)

| As a user I tried to… | Gap found | Fix shipped |
|---|---|---|
| Connect my main Gmail the easy way | Only IMAP app-passwords — fiddly | **Google OAuth** (read + send + Calendar) |
| Add a sub the app missed | No manual-add UI | **+ Add** form |
| Pull in subs from my bank app screenshot | No image path | **Screenshot import** (Claude vision) |
| Bulk-import a spreadsheet | None | **CSV import** (flexible headers) |
| Cancel everything I don't use at once | Only one-at-a-time | **Cancel all unused / converting trials**, bulk-select |
| Know if a price crept up | Not tracked | **Price-change detection** + badge + history |
| See if cancelling actually saved money | No payoff view | **Savings tracker** (annualized + realized) |
| Judge my overall situation | No summary metric | **Health score (A–F)** |
| See spend direction over time | Only current totals | **Spend-over-time trend chart** |
| Drill into one subscription | No detail view | **/sub/[id]** detail page (charges, actions, plan) |
| Find a specific sub fast | No search/filter/sort | **Search + status/category filter + sort** |
| Cancel a big service reliably | Generic guidance only | **Cancellation playbooks** (Netflix, Spotify, Adobe, …) |
| Trust low-confidence detections | All shown equally | **Review queue** flag for <50% confidence |
| Get reminded before a renewal | None | **.ics download + Google Calendar push** |
| Export my data | None | **CSV report export** |
| "What if I cancel these 3?" | None | **What-if savings** on multi-select |

## ✅ Full feature list (built)

**Sources** — Google OAuth Gmail · multi-mailbox IMAP · Plaid bank/cards · manual add · CSV import · screenshot (vision) import.
**Detection** — Claude extraction (regex fallback) · cross-source dedupe/merge · price-change detection · charge-history recording · low-confidence review queue.
**Visibility** — monthly + annualized spend · active count · savings tracker · health score · upcoming-renewals timeline · spend-by-category · spend-over-time trend · per-sub detail (charge + action history) · search/filter/sort · CSV export.
**Cancel (full-auto)** — one-click List-Unsubscribe (RFC 8058) → SMTP/Gmail unsubscribe email → playbook/Tavily-researched + Playwright web cancel · bulk cancel (unused/trials/selected) · cancel-plan preview with retention tips.
**Reminders** — .ics export · Google Calendar push.
**Safety** — protect flag · dry-run · global kill-switch · confirm-over-$ threshold · encrypted credentials · full audit log.

## 🚧 Engineer's roadmap — what I'd build next

1. **Scheduled background sync + push/email digest** (weekly "here's what renews + leaks" summary). Needs a cron route + a notifier (`lib/notify.ts`); reuse Gmail send.
2. **Retention/negotiation assistant** — Claude drafts a "pause / downgrade / ask-for-discount" message before you cancel (playbooks already carry `retentionTip`).
3. **Virtual-card / block-merchant guidance** when a service won't let you cancel online.
4. **Browser-extension or email-forwarding capture** so new receipts land instantly without a full inbox scan.
5. **Multi-currency** normalization with live FX (store native + USD).
6. **Shared/household subscriptions** — split cost, per-member ownership.
7. **Anomaly alerts** — "charged 2× this month" / "charged after you cancelled."
8. **Confidence-driven review inbox** — approve/reject detections to train better merchant keys.
9. **Encryption-key in OS keychain** instead of `.env`; per-user auth for multi-user/hosted mode.
10. **Playwright cancel-flow recorder** — record a cancel once, replay it as a per-merchant macro.
