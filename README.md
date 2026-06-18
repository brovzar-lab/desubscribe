# desubscribe

Find **everything you're paying for** across your inboxes and bank/cards, see **how much** and
**when it's due**, and let AI **unsubscribe / cancel** — full-auto, with an audit trail.

It fuses three signals into one deduplicated list:

- **Email** (multiple mailboxes via IMAP app-passwords) — receipts, invoices, renewals, trials. Claude reads
  messy emails into structured facts (name, amount, currency, cycle, next due date, cancel link).
- **Bank & cards** (Plaid) — catches **silent renewals that never email you**, using Plaid's recurring-charge
  detection (merchant, amount, cadence, predicted next date).
- **Manual** — anything you add by hand.

Then a **full-auto cancel engine** escalates through the cheapest reliable method first:
`one-click List-Unsubscribe (RFC 8058)` → `SMTP unsubscribe/cancel email` → `Tavily-researched + Playwright-driven cancel page`.

## What you get

- **Dashboard** — total **monthly** & **annualized** spend, active count, upcoming-renewals timeline,
  spend-by-category chart.
- **Money-leak insights** — free trials about to convert, duplicate categories (two music apps…), unused
  subscriptions (no recent charge), priciest tiers.
- **One-click & full-auto cancel** per subscription or in bulk.
- **Activity / audit log** — every automated action with status, request/response, and screenshots of web cancels.

## Safety (because cancelling is full-auto)

- **Protect** flag per subscription → never auto-cancelled (🔒 in the table).
- **Dry-run** → simulate the whole pipeline, send/click nothing.
- **Global kill-switch** in Settings → pause all automation instantly.
- **Confirm-over threshold** (`AUTO_CANCEL_CONFIRM_OVER`) → still ask before cancelling expensive subs.
- Mailbox & Plaid credentials are **encrypted at rest** (AES-256-GCM). Everything is local SQLite.

## Tools & integrations

| Need | Tool |
|---|---|
| Read inboxes (many accounts) | IMAP (`imapflow`) + `mailparser` |
| Send unsubscribe/cancel emails | `nodemailer` (SMTP) |
| Detect bank/card subscriptions | Plaid `/transactions/recurring/get` |
| Extract facts / research cancels | Claude API (`@anthropic-ai/sdk`) |
| One-click unsubscribe | `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) |
| Find a merchant's cancel page | Tavily search API |
| Drive cancel pages | Playwright (optional) |

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
2. **Email** — Settings → add each mailbox with an **app-password** (Gmail: Account → Security → App passwords).
   IMAP/SMTP hosts auto-fill for Gmail/Outlook/Yahoo/iCloud.
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
