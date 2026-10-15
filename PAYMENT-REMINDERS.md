# SMS payment reminders

The daily scheduler sends reminders only to approved, unbanned members who have opted in and have a valid Tanzanian phone number. It sends one reminder three days before a contribution is due, on the due date, and every seven days after the due date until verified payments cover the contribution. Canceled contributions and fully paid contributions are skipped. Members can opt out in Dashboard → Settings.

## Setup

1. Apply `supabase/migrations/20261016001500_payment_reminders.sql` to the Supabase project.
2. Create a Beem Africa API key and secret, and configure an approved sender address.
3. Set these environment variables on the Render service:
   - `BEEM_API_KEY`
   - `BEEM_SECRET_KEY`
   - `BEEM_SOURCE_ADDR`
   - `REMINDER_CRON_SECRET` — use a long, randomly generated secret.
4. Add `PUBLIC_SITE_URL` and the same `REMINDER_CRON_SECRET` as GitHub Actions repository secrets. Set `PUBLIC_SITE_URL` to the deployed site origin, such as `https://mchezo-wetu.onrender.com`.
5. Run the **Payment SMS reminders** GitHub Actions workflow manually once to verify the connection. It also runs daily at 03:00 UTC (06:00 in Tanzania).

Beem may charge for SMS after any trial credits are exhausted. Configure billing and verify the sender address with Beem before enabling real delivery. Existing members remain opted out until they explicitly enable SMS reminders.
