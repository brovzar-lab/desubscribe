# desubscribe

Find **everything you're paying for** across your inboxes and bank/cards, see **how much** and
**when it's due**, and let AI **unsubscribe / cancel** — full-auto, with an audit trail.

It fuses every signal into one deduplicated list:

- **Gmail via Google OAuth** — one-click connect; reads receipts, sends cancellations, drives Calendar reminders.
- **Any mailbox via IMAP** (app-passwords) — multiple inboxes, since subscriptions hide across addresses.
- **Bank & cards** (Plaid) — catches **silent renewals that never email you** (merchant, amount, cadence, next date).
- **Screenshot import** — drop a bank-app / app-store / billing screenshot; Claude vision extracts the subs.
- **CSV import** and **manual add** — anything else.

Claude reads messy emails/images into structured facts (name, amount, currency, cycle, next due date, cancel link),
then everything is deduplicated across sources.

Then a **full-auto cancel engine** escalates through the cheapest reliable method first:
`one-click List-Unsubscribe (RFC 8058)` → `SMTP unsubscribe/cancel email` → `Tavily-researched + Playwright-driven cancel page`.

## What you get

- **Dashboard** — monthly & annualized spend, active count, **savings tracker**, **health score (A–F)**,
  upcoming-renewals timeline, spend-by-category, **spend-over-time trend**.
- **Money-leak insights** — trials about to convert, duplicate categories, unused subs, priciest tiers,
  **price-increase detection**, low-confidence **review queue**.
- **Per-subscription detail page** — charge history, action history, and a cancel-plan preview (with retention tips).
- **Search / filter / sort**, multi-select with a live **what-if savings** estimate, and **CSV export**.
- **Full-auto cancel** per sub or in bulk (**cancel all unused / converting trials**), backed by **cancellation
  playbooks** for big services (Netflix, Spotify, Adobe, Disney+, Prime, NYT, Hulu, YouTube, Apple…).
- **Reminders** — download a `.ics` of all renewals or push them to **Google Calendar**.
- **Billing anomaly alerts** — double charges, charges *after* you cancelled, and price spikes.
- **Retention assistant** — Claude drafts a pause / downgrade / ask-for-a-discount message before you cancel.
- **Weekly digest + scheduled sync** — `POST /api/cron` (sync + email digest) for any scheduler; preview at `/api/digest`.
- **Activity / audit log** — every automated action with status, request/response, and screenshots of web cancels.

See **[FEATURES.md](./FEATURES.md)** for the full tester findings + engineering roadmap.

## Safety (because cancelling is full-auto)

- **Protect** flag per subscription → never auto-cancelled (🔒 in the table).
- **Dry-run** → simulate the whole pipeline, send/click nothing.
- **Global kill-switch** in Settings → pause all automation instantly.
- **Confirm-over threshold** (`AUTO_CANCEL_CONFIRM_OVER`) → still ask before cancelling expensive subs.
- Mailbox & Plaid credentials are **encrypted at rest** (AES-256-GCM). Everything is local SQLite.

## Tools & integrations

| Need | Tool |
|---|---|
| Connect Gmail (read+send) + Calendar | Google OAuth (`googleapis`) |
| Read inboxes (many accounts) | IMAP (`imapflow`) + `mailparser` |
| Send unsubscribe/cancel emails | Gmail API / `nodemailer` (SMTP) |
| Detect bank/card subscriptions | Plaid `/transactions/recurring/get` |
| Extract facts / vision / research cancels | Claude API (`@anthropic-ai/sdk`) |
| One-click unsubscribe | `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) |
| Cancel big services | Built-in **playbooks** + Tavily search fallback |
| Drive cancel pages | Playwright (optional) |
| Import / export | `papaparse` (CSV), vision (screenshots) |
| Renewal reminders | `.ics` (RFC 5545) + Google Calendar API |

## Quick start

```bash
npm install
cp .env.example .env          # fill in keys later — runs in DEMO MODE without them
npm run setup                 # create SQLite DB + seed demo subscriptions
npm run dev                   # http://localhost:3000
```

Open the dashboard — it's populated with **sample data** so you can see it work immediately.

### Go live (real data)

1. **Claude key** — put `ANTHROPIC_API_KEY` in `.env` (or paste it in Settings). Without it, extraction falls
   back to regex heuristics.
2. **Email** — either **Connect Gmail with Google** (set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, add the
   redirect URI `http://localhost:3000/api/google/callback`), **or** add any mailbox with an **app-password**
   (IMAP/SMTP hosts auto-fill for Gmail/Outlook/Yahoo/iCloud).
3. **Bank** — set `PLAID_CLIENT_ID` / `PLAID_SECRET` (start with `PLAID_ENV=sandbox`), then Settings → Connect a bank.
4. **Cancel research** — add `TAVILY_API_KEY` to look up cancellation pages.
5. **Web cancels** (optional) — `npm i playwright && npx playwright install chromium`.
6. Click **Sync now**. Review, then **Cancel** (or Dry-run first).

## How it works

```
inboxes ─IMAP─▶ extract (Claude) ─┐
                                  ├─▶ dedupe/merge ─▶ Subscriptions ─▶ dashboard + insights
bank ───Plaid recurring ──────────┘                          │
                                                              └─▶ cancel engine ─▶ audit log
```

Key code: `lib/sync.ts` (orchestrator), `lib/email/{imap,extract,unsubscribe}.ts`, `lib/plaid.ts`,
`lib/dedupe.ts`, `lib/insights.ts`, `lib/cancel/{engine,research,webCancel}.ts`.

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm run setup` — generate client, push schema, seed demo data
- `npm test` — unit tests for unsubscribe parsing, dedupe, and spend/insights

## Notes & limits

- **Web-cancel automation is best-effort.** Every merchant's flow differs and changes; many require a login or
  confirmation a bot shouldn't complete unattended. The email/one-click paths are the reliable backbone —
  web cancels open the page, attempt the obvious step, and screenshot it for you to verify.
- Single-user local tool — no auth/multi-tenant. Keep `dev.db` and `.env` private; set a real `ENCRYPTION_KEY`.
