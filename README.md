# Juristic Platform

Early implementation of the apartment utility and common-area billing system.

1. Install Node.js 24 and create a Supabase PostgreSQL project.
2. In Supabase, open **Connect**, choose the **Session pooler**, and copy its URI. The app requires TLS for remote databases. It uses Supabase's `sslmode=require` behavior by default. To verify the server certificate too, download the CA certificate from Supabase Database Settings and add `sslmode=verify-full&sslrootcert=/path/to/cert` to the URI.
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `SESSION_SECRET`, and `SEED_ADMIN_PASSWORD`.
4. Run `npm ci`.
5. Run `npm run db:reset`.
6. Start with `npm run dev`.
7. Open `http://localhost:3000/login` and sign in as `admin` with the seed password.

`GET /healthz` reports database availability. The app uses PostgreSQL via `pg`; the session store is also PostgreSQL-backed through `connect-pg-simple`.

The current operator flow is **Dashboard → Meter Readings → Monthly Bills → Receipt**. Save water and electricity readings for a room, generate its Draft bill, approve it as Admin, then confirm cash payment to open the receipt. The room 205 demo uses 1,250 → 1,260 water units and 5,280 → 5,350 electricity units for a total of 1,790.00 baht.

`npm run db:reset` is a development/demo reset: it drops and recreates all application tables, then seeds the 80-room demo dataset. Do not run it against a production database containing real data.

For an existing initialized database, run `npm run db:upgrade` before starting the updated app.
It adds the reminder notification columns and deduplication index without resetting application
data. Daily reminders are queued two days before the due date and on overdue days 1, 8, and 15;
same-day retries and concurrent jobs do not duplicate reminders. Paid bills and bills with a
voided payment are excluded.

`npm test` runs unit tests and, when `TEST_DATABASE_URL` is set in `.env.test`, database-backed
integration tests. The integration suite uses a temporary schema with no `public` fallback and
checks that public application data stays unchanged. See [test/integration/README.md](test/integration/README.md).

Run `npm run rehearse` to verify the documented room 205 demo arithmetic without a database.
Run `npm run test:e2e` for read-only browser smoke checks. See [test/e2e/README.md](test/e2e/README.md) for the opt-in full room 205 browser scenario; it writes disposable demo data.
Run `npm run test:e2e:isolated` with `TEST_DATABASE_URL` in `.env.test` to exercise all five browser
scenarios in a temporary schema while preserving the public demo data.
