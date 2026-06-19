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

## ✅ Roadmap wave 2 — now shipped

- **Multi-currency + live FX** — base-currency setting; all aggregate math normalizes native amounts to the base
  via daily-cached FX (`api.frankfurter.dev`), with an offline fallback table. Per-row shows native currency.
  `lib/fx.ts`. (Live rates need that host allowed in egress; otherwise approximate fallback is used.)
- **Review inbox** (`/review`) — approve / reject / **merge** low-confidence detections. Merging **learns a
  `MerchantAlias`** so future syncs fold that variant automatically. `lib/sync.ts` applies aliases before dedupe.
- **Email-forward / paste capture** — `POST /api/ingest/email` (raw RFC822 or `{from,subject,text}`) extracts one
  receipt without a full inbox scan; "Paste receipt" box on the dashboard.

## ✅ Roadmap wave 3 — now shipped

- **Household & cost splitting** (`/household`) — add members, split any subscription across them, see
  per-member monthly totals and **your share** (currency-normalized). `lib/household.ts`, `Member` model +
  `Subscription.sharedWith` m2m, `/api/members`, `/api/subscriptions/[id]/share`.
- **Cancel-macro recorder/replayer** — record a cancel once with `npx playwright codegen`, save the steps
  (`/api/macros`), and the web-cancel engine **replays them precisely** instead of heuristic clicking.
  `CancelMacro` model, `lib/cancel/macro.ts`, button on the detail page.
- **Virtual-card / block-merchant guidance** — when a service stonewalls, the plan preview shows how to cut the
  charges off (virtual card, stop-payment, dispute). `lib/cancel/blockGuidance.ts`.

## 🚧 Engineer's roadmap — still ahead

1. **Encryption-key in OS keychain** instead of `.env`; per-user auth for multi-user/hosted mode.
2. **Inbound email webhook** (a forwarding address) to auto-capture receipts in real time.
3. **In-app cancel-macro recorder** (launch a headed browser, capture clicks) so you don't need the CLI.
4. **Spending forecasts** — project next 12 months incl. known annual renewals.
