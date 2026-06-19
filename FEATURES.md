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

## ✅ Roadmap items now shipped

- **Scheduled sync + weekly digest** — `POST /api/cron` (sync + email) for an OS/external scheduler with
  optional `CRON_SECRET`; `GET/POST /api/digest` to preview/send. Digest = spend, renewals (14d), leaks,
  anomalies, savings. Code: `lib/digest.ts`.
- **Retention/negotiation assistant** — Claude drafts a pause/downgrade/discount message (uses playbook
  `retentionTip`); can save it as a Gmail draft or send. `lib/retention.ts`,
  `/api/subscriptions/[id]/retention`, button on the detail page.
- **Anomaly alerts** — double charges, charges after cancellation, and price spikes, surfaced on the dashboard
  and in the digest. `lib/anomalies.ts`.

## 🚧 Engineer's roadmap — still ahead

1. **Virtual-card / block-merchant guidance** when a service won't let you cancel online.
2. **Browser-extension or email-forwarding capture** so new receipts land instantly without a full inbox scan.
3. **Multi-currency** normalization with live FX (store native + USD).
4. **Shared/household subscriptions** — split cost, per-member ownership.
5. **Confidence-driven review inbox** — approve/reject detections to train better merchant keys.
6. **Encryption-key in OS keychain** instead of `.env`; per-user auth for multi-user/hosted mode.
7. **Playwright cancel-flow recorder** — record a cancel once, replay it as a per-merchant macro.
