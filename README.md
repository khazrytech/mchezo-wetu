# Mchezo Wetu

Member and admin portal for a Tanzanian savings/chama group. Members sign in by email OTP, view assigned contributions, pay through mobile money, and upload receipts. Admins approve members, assign contributions, review payments, and publish announcements.

## Stack

- **Backend** — Node.js 20, Express 4, `@supabase/supabase-js` (service role), `helmet`, `express-rate-limit`, `axios`, `resend`.
- **Frontend** — static HTML files with inline CSS/JS (no build step): `index.html` (login/signup), `dashboard.html` (member), `admin-login.html`, `admin.html` (admin).
- **Database & auth** — Supabase Postgres + Supabase Auth (email OTP link generated server-side, verified server-side).
- **Email** — Brevo transactional API for OTP and member notifications.
- **SMS** — Beem Africa for contribution payment reminders.
- **Payments** — manual mobile money/bank/cash entries reviewed by an admin, plus the SonicPesa gateway with an HMAC-signed webhook.

## Requirements

- Node.js 20 or newer
- A Supabase project (URL, anon/publishable key, service role key)
- Brevo account with a verified sender (OTP email)
- Optional: Beem Africa account (SMS reminders), SonicPesa account (online payments)

## Local setup

```bash
npm install
cp .env.example .env      # then fill in the values
npm start                 # http://localhost:3000
```

Apply the SQL migrations in `supabase/migrations/` to your Supabase project in filename order (they are idempotent), through the Supabase SQL editor or the Supabase CLI. The server creates the `payment-proofs` storage bucket on first receipt upload, so no manual bucket setup is required.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | yes | Public anon/publishable key, returned to the browser by `/api/config` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only key used for all database and auth admin work |
| `ADMIN_EMAIL` | no | Primary admin email (defaults to the built-in address) |
| `BREVO_API_KEY` | yes | Sends OTP and notification email |
| `BREVO_SENDER_EMAIL` | no | Verified Brevo sender address |
| `BREVO_SENDER_NAME` | no | Sender display name |
| `BEEM_API_KEY` | no | SMS reminders |
| `BEEM_SECRET_KEY` | no | SMS reminders |
| `BEEM_SOURCE_ADDR` | no | Approved Beem sender ID |
| `REMINDER_CRON_SECRET` | no | Bearer secret that protects `/api/cron/payment-reminders` |
| `SONICPESA_API_KEY` | no | Online payment initialsation |
| `SONICPESA_API_SECRET` | no | HMAC secret that verifies `/webhook/sonicpesa` |
| `PUBLIC_SITE_URL` | no | Deployed origin used by the reminder cron workflow |
| `PORT` | no | Server port, defaults to `3000` |

## Migrations

| File | Adds |
| --- | --- |
| `20261016000000_admin_review_metadata.sql` | Payment review metadata (reviewer, review timestamps, rejection reason) |
| `20261016001500_payment_reminders.sql` | SMS reminder preferences and reminder logs |
| `20261020100000_core_schema.sql` | `profiles`, `contributions`, `payments`, `audit_logs`, indexes, RLS + grants |
| `20261020100100_announcements.sql` | `announcements` table |
| `20261020100200_reporting_rpc.sql` | `admin_summary_stats()` aggregation used by the admin dashboard |

## Features

**Members** — email OTP sign in, dashboard summary with a due-date countdown, contribution list, payment history with CSV export and receipt download, online payment through SonicPesa, receipt upload for manual payments, announcements, avatar and profile editing, SMS reminder opt-in.

**Admins** — summary statistics, member list with server-side search/pagination and bulk approve/ban/unban, per-member detail with balances and history, contribution assignment and cancellation, payment review with bulk verify/reject, receipt viewing, announcements CRUD, and an audit log of every privileged action.

## PWA

`manifest.webmanifest`, `service-worker.js` and `app-pwa.js` provide an installable app shell. The service worker caches static assets and public entry pages only — authenticated pages (`/dashboard`, `/admin`) are never written to the cache.

## Payment reminders

See [PAYMENT-REMINDERS.md](PAYMENT-REMINDERS.md). The daily GitHub Actions workflow calls `POST /api/cron/payment-reminders` with the `REMINDER_CRON_SECRET` bearer token.

## Testing and CI

```bash
npm run check    # node --check server.js
npm test         # node --test (boots the app with dummy Supabase settings)
```

`test/server.test.js` starts the Express app on an ephemeral port with placeholder Supabase credentials and asserts routing, authentication guards, static asset delivery, icon availability and service worker behaviour. It never calls the network. `.github/workflows/ci.yml` runs both commands on every push to `main` and on pull requests.

## Deployment

Deploy to Render as a web service: build command `npm install`, start command `npm start`, and set every variable from the table above in the service environment. Add `PUBLIC_SITE_URL` and `REMINDER_CRON_SECRET` as GitHub Actions repository secrets so the reminder workflow can reach the deployed API.

## Project structure

```
server.js                    Express app: API, auth, payments, reminders, static pages
index.html                   Member login and signup
dashboard.html               Member portal
admin-login.html             Admin login
admin.html                   Admin control center
service-worker.js            PWA offline shell
app-pwa.js                   PWA install prompt
manifest.webmanifest         PWA manifest
offline.html                 Offline fallback page
pwa-icon*.png|svg            App icons
supabase/migrations/         SQL migrations
test/                        Node test runner smoke tests
.github/workflows/           CI and reminder cron
```

## Security notes

- All privileged routes require a Supabase bearer token; admin routes additionally verify `role = 'admin'` and reject banned accounts.
- The service role key stays on the server; the browser only receives the anon/publishable key.
- Helmet sets a strict content security policy, HSTS, `X-Frame-Options: deny` and a restrictive permissions policy.
- OTP endpoints are rate limited (8 requests per 15 minutes) and all API routes are capped at 300 requests per minute.
- Payment references carry a partial unique index, so a duplicate reference is rejected with HTTP 409.
- Tables are protected with row level security and only `service_role` is granted access; there are no anonymous policies.
- The SonicPesa webhook verifies an HMAC-SHA256 signature over the raw body with a timing-safe comparison, and only processes each order once.
