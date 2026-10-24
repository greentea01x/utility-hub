# Juristic Platform

Apartment utility and common-area billing system for **สุขธารา เรสซิเดนซ์**.

1. Install Node.js 24 and create a Supabase PostgreSQL project.
2. In Supabase, open **Connect**, choose the **Session pooler**, and copy its URI. The app requires TLS for remote databases. It uses Supabase's `sslmode=require` behavior by default. To verify the server certificate too, download the CA certificate from Supabase Database Settings and add `sslmode=verify-full&sslrootcert=/path/to/cert` to the URI.
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `SESSION_SECRET`, and `SEED_ADMIN_PASSWORD`.
4. Run `npm ci`.
5. Run `npm run db:reset`.
6. Start with `npm run dev`.
7. Open `http://localhost:3000/login` and sign in as `admin` with the seed password.

`GET /healthz` reports database availability. The app uses PostgreSQL via `pg`; the session store is also PostgreSQL-backed through `connect-pg-simple`.

The current operator flow is **Dashboard → Meter Readings → Monthly Bills → Receipt**. Save water and electricity readings for a room, generate its Draft bill, approve it as Admin, then confirm cash payment to open the receipt. The room 205 demo uses 1,250 → 1,260 water units and 5,280 → 5,350 electricity units for a total of 1,790.00 baht.

The interface follows a reference blue/white/gray theme, with original local SVG
illustrations and a self-hosted Noto Sans Thai font. The font and its OFL license are included in
`public/fonts/`; original illustrations are in `public/images/`. No external image or font service is
required to render the app. Fourteen colored Twemoji SVGs are self-hosted in `public/emoji/`
with their graphics license; the supporting apartment photograph is credited to Ciro Rizzo on
Unsplash. See `/image-credits.html` and `public/images/PHOTO-CREDIT.md`. The photo is illustrative,
not an image of the actual residence. Supporting copy, empty states, Thai status badges, and mobile
layouts are designed for office use.

The shared Thai interface uses a blue sidebar with light-blue highlights on desktop and a collapsible menu with bottom
navigation on mobile. Admin menus follow the engineering specification: Overview, Meter Readings,
Monthly Bills, Payments (with a separate history tab), Rooms, Tenants, Announcements, Reports,
Settings, and Users. Staff see only Overview, Meter Readings, and Rooms.

The admin dashboard supports month navigation, ten summary cards, twelve-month water/electricity
charts, bill status, and shortcuts. Monetary cards exclude Draft/Voided bills; paid totals follow
the bill's period, while payment history follows the Bangkok month in which money was received.
Accumulated arrears include Unpaid bills through the selected period. Charts use actual saved meter
consumption and show zero for months without readings. The legacy summary API retains its earlier
contract; `/api/dashboard/charts` returns twelve chronological usage points.

Meter Readings includes room search, completeness/vacancy filters, progress, previous/current
values, and inline validation. Every save requires the building technician's manually entered name
(2–100 characters); the field starts blank each time. The name and timestamp are shown separately
for water and electricity, while the authenticated account remains recorded for auditing.
`POST /api/readings` also requires `technician_name`. Legacy readings retain an unspecified-name
label instead of receiving invented names. Mobile layouts display each room as a card. The new Users page is
read-only. The Reports menu links to the existing arrears report and marks the other three reports
as pending; full CRUD, meter replacement, bill revert, payment void, and external LINE delivery
remain separate implementation work.

`npm run db:reset` is a development/demo reset: it drops and recreates all application tables, then seeds the 80-room demo dataset. Do not run it against a production database containing real data.

For an existing initialized database, run `npm run db:upgrade` before starting the updated app.
It adds the reminder notification columns, deduplication index, audit table, legacy residence-name update,
and nullable technician-name field without resetting
application data. Schema resets also apply all upgrades. Daily reminders are queued two days
before the due date and on overdue days 1, 8, and 15;
same-day retries and concurrent jobs do not duplicate reminders. Paid bills and bills with a
voided payment are excluded.

Staff land on Meter Readings and can inspect rooms, save meters, and see room counts and reading
progress. A shared route/navigation policy blocks billing, receipts, financial charts/reports/CSV,
tenants, settings, announcements, notification draining, and room mutations. The staff dashboard
query reads only rooms and meters, so amounts and rates never enter its response.

Reading creation/edits, bill approval, cash payment, LINE binding, and announcement creation write
audit snapshots on the same database connection and transaction as the change. If an audit insert
fails, the business change rolls back. Database triggers reject ordinary audit UPDATE, DELETE,
and TRUNCATE operations; this does not restrict a database owner from changing the schema.
User actions require an actor user ID. Signed LINE linking records `actor_source=line_webhook`
and no user ID because a tenant webhook has no application login. One-time link codes and
credentials are excluded from audit snapshots. The specification's `ANNOUNCEMENT_SEND` action
currently records creation with `delivery_status=not_dispatched`; real LINE delivery and fan-out
remain to be implemented.

`npm test` runs unit tests and, when `TEST_DATABASE_URL` is set in `.env.test`, database-backed
integration tests. The integration suite uses a temporary schema with no `public` fallback and
checks that public application data stays unchanged. See [test/integration/README.md](test/integration/README.md).

Run `npm run rehearse` to verify the documented room 205 demo arithmetic without a database.
Run `npm run test:e2e` for read-only browser smoke checks. See [test/e2e/README.md](test/e2e/README.md) for the opt-in full room 205 browser scenario; it writes disposable demo data.
Run `npm run test:e2e:isolated` with `TEST_DATABASE_URL` in `.env.test` to exercise all eight browser
scenarios in a temporary schema while preserving the public demo data.

## Selected resident LINE menu prototype — 2026-10-16

The user selected the six pastel emoji menu cards as the direction for future resident-facing
development. Open `/resident-preview/` on the local server to try the home screen and six linked
pages: bills, payment history, receipts, room information, announcements, and office contact.
The prototype uses fictional room 205 data, is separate from the operator application, and does
not connect to LINE, authentication, real payments, or the database. The approved mockup brand
is retained in this prototype; the operator application's residence configuration is unchanged.
The design decision, scope, and local preview instructions are saved in
[`public/resident-preview/README.md`](public/resident-preview/README.md) and
[`design-decision.json`](public/resident-preview/design-decision.json).
