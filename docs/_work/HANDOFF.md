# Current handoff — Juristic Platform

Updated: 2026-10-10 (Asia/Bangkok)

## Read this first

This section supersedes the 2026-09-20 MySQL-era implementation handoff preserved below. The
application is now configured for **Supabase PostgreSQL** through the Session Pooler. Do not follow
the old instructions to start MySQL or create MySQL databases. The current setup and operator flow
are in [`README.md`](../../README.md); browser-test setup is in
[`test/e2e/README.md`](../../test/e2e/README.md), and database integration setup is in
[`test/integration/README.md`](../../test/integration/README.md).

The PostgreSQL migration, UI flow, integration coverage, and browser tests are committed in
`910184f` (`feat: migrate billing workflow to Supabase PostgreSQL`). Staff access restrictions and
transactional audit logging are committed in `50019e2` (`feat: enforce staff access and transactional
audit history`). The audit upgrade has been applied to the live demo without resetting any data.
The untracked `tmp/` directory
and unrelated SVG/PNG files are user-owned and were excluded from the commits; do not remove or
reset them during cleanup. Database credentials remain in ignored local `.env`/`.env.test` files.

## What has been implemented and verified

- PostgreSQL schema/seed/reset and PostgreSQL-backed sessions replace the earlier MySQL setup.
  `db/connection.js` configures TLS for remote databases. The default Supabase `sslmode=require`
  encrypts traffic but does **not** verify the server certificate; the README documents the optional
  CA/`verify-full` configuration.
- The usable operator path is Dashboard → Meter Readings → Monthly Bills → Receipt. A user can save
  room readings, generate a Draft bill, approve it, confirm cash payment, and view/print its receipt.
- Room 205 demo arithmetic: water 1,250 → 1,260 costs 180.00; electricity 5,280 → 5,350 costs
  560.00; common area 30 × 35 costs 1,050.00; total **1,790.00 baht**.
- Playwright has four default read-only browser smoke tests plus the database-mutating room 205
  and staff meter scenarios. **All six passed in Chrome on 2026-10-10** using the
  `npm run test:e2e:isolated` command. This covers readings, bill, approval, payment, receipt,
  print action, duplicate-payment rejection (409), and paid-dashboard count. The scenario ran in a
  temporary test schema, which was removed afterwards; public demo data was preserved. The runner
  also verified four reading-create audit rows, one approval audit, and one payment audit.
- There are **35 database integration tests** covering schema/reset, login/session regeneration,
  CSRF, logout, billing/payment/receipt staff restrictions, readings and transaction rollback,
  generation/approval and concurrency, decimal amounts, payments/receipts, link-code consumption,
  daily jobs, upgrades, the staff route matrix, nonfinancial dashboard queries, audit snapshots,
  concurrent auditing, append-only guards, and audit-failure rollback. Tests use their own schema
  with an exclusive `search_path`, reset only
  that schema, and compare public application-table counts/checksums before and after each suite.
- Billing amounts and totals now use PostgreSQL decimal arithmetic, generation counts only new
  drafts, and concurrent generation does not duplicate bills/items. Invalid calendar months and
  multibyte/non-string CSRF tokens are rejected. Staff cannot access bill generation, approval,
  cash-payment routes, or receipts.
- A single staff allowlist now drives protected routes and navigation. Staff land on readings,
  can inspect rooms and save meters, and receive only room counts and reading progress from the
  dashboard. Financial charts, reports/CSV, tenants, settings, announcements, notification drain,
  and room mutations return 403. The reduced dashboard queries only rooms and meters; an
  integration test verifies it still works with the financial tables renamed.
- Reading creates/edits, approval, cash payment/receipt persistence, LINE binding, and announcement
  creation insert audit snapshots in the business transaction on the same connection. Tests
  deliberately reject audit inserts and verify that every associated business mutation rolls back.
  Concurrent approval/payment/link consumption each produce one successful event and audit row.
  Identical reading saves preserve the row without creating an edit audit. Database triggers
  reject ordinary audit UPDATE, DELETE, and TRUNCATE; database owners can still change the schema.
- PostgreSQL audit adaptation: user actions require `actor_user_id`, while tenant LINE webhooks
  have `actor_source=line_webhook` and a null user ID, constrained to `TENANT_LINE_LINK`. This is
  an explicit adaptation of the historical MySQL spec's non-null user actor because webhook
  senders have no application login. One-time codes and credentials are not included in snapshots.
  `ANNOUNCEMENT_SEND` currently audits creation with `delivery_status=not_dispatched`; it does not
  certify external delivery. Other audit action types will be wired as their CRUD/correction flows
  are implemented; there is no global audit-browser UI.
- Daily reminders follow the specification: two days before due, then overdue days 1/8/15,
  excluding Paid bills and bills with voided payments. A per-bill/tenant/type/Bangkok-day unique
  index prevents duplicates during retries and concurrent jobs. `npm run db:upgrade` adds the
  required columns/index without resetting existing data; it was tested and applied to the demo.
- The new Supabase project was initialized on 2026-10-10 after confirming that its public schema
  was empty. Schema creation and demo seeding ran in one transaction. The final live check found
  80 rooms, 67 tenants, two seeded readings, zero bills/payments/receipts/notifications, and zero
  remaining temporary test schemas. The later audit upgrade preserved the counts/checksums of
  every existing application table and created an empty audit table with its immutable trigger.

## Checks run on 2026-10-10

- `npm run lint` — passed.
- `npm test` with `TEST_DATABASE_URL` — **36 passed** (35 PostgreSQL integration tests and the
  existing CSRF unit test), with no skips. Test scripts now use file globs compatible with Node 24.
- `npm run test:e2e:isolated` — **all six Chrome tests passed**, including the full room 205 path,
  staff meter entry, forbidden-route checks, and verification of resulting audit records.
- `npm run rehearse` — passed, producing the 1,790.00 baht room 205 result.
- `git diff --check` — passed.
- The initial database check failed with a pooler `tenant/user ... not found` error. The user then
  created a new Supabase project and updated the local `.env` `DATABASE_URL`. The new Session
  Pooler connection **passed**, and the client connection is encrypted. Do not print `.env` or
  credentials.
- The app is running at `http://127.0.0.1:3000`; `/healthz` returned HTTP 200 with `status: ok`, and
  the collaborative preview is open at `/login`.
- Four default Chrome browser smoke tests also passed against the public demo earlier in the
  session. The later full browser run used an isolated schema. Public application counts and
  checksums were unchanged after the integration and full-browser suites.
- `npm run db:upgrade` — reminder and audit upgrades passed against the demo database; no reset
  was performed. Pre/post row counts and checksums of existing application tables matched.
- An ignored `.env.test` was created with `TEST_DATABASE_URL` for the isolated test commands.
- App and browser validation used Node 24.21.0 through `npm exec --yes --package=node@24 -- ...`.
  The machine's default Node is 26.8.1, outside the repository's declared Node 24 range. The
  running dev server was started with `npm exec --yes --package=node@24 -- npm run dev`.

## Recommended next session

1. Supabase connectivity, demo initialization, database integration tests, full browser validation,
   reminder/audit upgrades, staff access restrictions for implemented routes, and transactional
   audit logging are complete and committed.
   If the local app has stopped, use Node 24 to start it with `npm run dev` (or the `npm exec`
   command above); confirm `/healthz` and login at `http://127.0.0.1:3000/login`.
2. Run `npm test` and `npm run test:e2e:isolated` on Node 24 for isolated database and full-browser
   checks. The local `.env.test` is configured. There is no need to reset the public demo for these
   commands. Do not run `npm run db:reset` against data that must be kept.
3. **Next implementation milestone: bill revert and payment void flows**, including required
   reasons, state-transition restrictions, and audit rows in their transactions. Then continue
   full-spec hardening: remaining room/tenant/user/rate CRUD, meter replacement and staff submission
   for review, receipt print counts, real LINE sending, announcement fan-out, and pagination.
   New staff capabilities must be explicitly added to `lib/permissions.js`; new audited mutations
   must call `lib/audit.js` inside their business transaction. Add integration cases alongside
   those changes. The current notification drain still marks messages sent without calling LINE;
   a successful test run does not verify external delivery. No further Supabase setup is needed
   from the user for the next implementation milestone.

## Historical handoff (2026-09-20; superseded where inconsistent)

# Handoff — Juristic Platform documentation run

Updated: 2026-09-20

## Application implementation handoff

The application implementation is in the repository root, alongside the documentation. The
implementation was committed as separate milestone commits:

| Commit | Milestone |
|---|---|
| `97a8c82` | M0 walking skeleton, authentication, sessions, CSRF, dashboard shell |
| `3ee185e` | M1 rooms, tenants, settings, rates, demo seed |
| `5e58d9c` | M2 meter readings and previous-reading validation |
| `d7e18ae` | M3 draft bill generation and bill items |
| `95a5c9f` | M4 cash payment and receipt persistence |
| `68d4ae8` | M4 bill approval and receipt view |
| `36f9d93` | M5 LINE link codes, signed webhook, notification queue |
| `ab0a4fd` | M6 announcements and daily reminder job |
| `68ca6a1` | M7 dashboard summary, arrears report, CSV export |
| `46e26c5` | M8 rehearsal command and final verification setup |
| `308b707` | M6 announcements template fix |

### Current application tree

- `server.js` — Express middleware order, sessions, route mounting, health check.
- `db/schema.sql`, `db/seed.sql`, `db/reset.js` — MySQL schema and demo data.
- `routes/` — auth, dashboard, rooms, tenants, settings, readings, bills, payments, LINE,
  notifications, announcements, reports, and internal job endpoints.
- `services/` — records, billing, payments, linking, jobs, and reports.
- `views/pages/` — server-rendered Thai pages.
- `test/rehearsal.js` — deterministic room 205 arithmetic check.

### Verification already run

These commands pass in the current environment:

```text
npm run lint
npm test
npm run rehearse
```

The rehearsal prints the expected room 205 result: water `180.00`, electricity `560.00`, common
area `1,050.00`, total `1,790.00`.

### Important limitations

MySQL 8.4 was not available locally, so `db/schema.sql`, `db/seed.sql`, session persistence, and
database integration tests have not been executed against a real server. The real LINE Messaging
API has not been exercised with channel credentials. The collaborative browser preview was
available, but the local Node process did not remain alive long enough for a browser smoke test.

Several routes are intentionally thin milestone implementations and still need hardening against
the full engineering specification: complete CRUD and role matrix coverage, audit logging, bill
revert/void flows, receipt print-count handling, real LINE sends, announcement recipient fan-out,
pagination, and full integration/E2E coverage.

### Recommended next session sequence

1. Start MySQL 8.4 and create `juristic` and `juristic_test` databases.
2. Copy `.env.example` to `.env`, set `DATABASE_URL`, `SESSION_SECRET`, `SEED_ADMIN_PASSWORD`,
   `JOB_TOKEN`, and LINE credentials.
3. Run `npm ci`, then `npm run db:reset` and inspect the seeded counts: 80 rooms, 67 tenants, 54
   LINE-linked tenants, and rates 18/8/35.
4. Add integration tests under `test/integration/` for schema reset, login, CSRF, reading save,
   bill generation/approval, duplicate payment, link-code consumption, and daily-job idempotency.
5. Start the app with `npm run dev` and use the T3 collaborative preview (`preview_status`,
   `preview_open`, `preview_navigate`, `preview_snapshot`) for login and the room 205 demo path.
6. Implement the remaining spec gaps above, keeping one commit per milestone or focused step.

## Status

The 4-role workflow (`wf_c8a91bd5-8e3`, 46 agents) finished. All five documents exist in `docs/`
and pass integrity checks (no `{{` placeholders, balanced `<section>` tags, every Mermaid block
renders to SVG with zero syntax errors, no horizontal overflow at 1440px):

| File | Owner | Size |
|---|---|---|
| `docs/index.html` | Team | documentation home |
| `docs/01-product-decisions.html` | Lead of Product | 47 decisions, scope, roles, glossary, demo seed |
| `docs/02-engineering-spec.html` | Principal Engineer | FR-01…49, ERD + MySQL DDL, API, billing engine, LINE, folder structure, plan |
| `docs/03-ui-design.html` | Senior Designer | foundations, user flows, 77 device-frame mockups, LINE chat mockups |
| `docs/04-test-plan.html` | Senior QA | strategy, ~278 test cases, 7 E2E scenarios, Playwright code, traceability matrix |

Inputs: `docs/PRD.md` (the PRD verbatim), `docs/_shared/template.html` (shared HTML head/CSS/TOC/Mermaid).

### Follow-up fix pass (done 2026-09-07)

The workflow's completeness critic left 5 medium + 3 low gaps. Three Opus fixers closed them,
partitioned by file so they never edited the same file. Afterwards the orchestrator corrected the
test-plan coverage card (P1 145, API 174), aligned the design doc's list page size with the spec's
50-row convention, and moved the mobile `@container` block to the end of `tokens.css` (and its
inlined copy) so mobile overrides win the cascade. Details of the fixer scope:

- `02-engineering-spec.html`: add `GET /payments/history` and `POST /rooms/:id/activate` to the API
  catalogue (+ ROOM_ACTIVATE audit action, view, milestone tasks); write the helmet CSP directives and
  font-source decision; fix Render env-var deploy step; map `tokens.css` → `public/css/app.css`; add a
  new **Operations Runbook** section (`#runbook`, h3 ids `runbook-deploy`, `runbook-webhook`,
  `runbook-line-token`, `runbook-lost-admin`, `runbook-regexp`, `runbook-backup`, `runbook-demo-day`,
  `runbook-daily-job`).
- `03-ui-design.html` (+ creates `docs/_shared/tokens.css`): Settings manual-job route →
  `POST /settings/run-daily-job`; ship tokens.css with the `@container` cascade fix; draw the A5
  LINE link-code slip; Settings test-mode field drawn empty (NULL state); link "runbook"/"User Manual"
  mentions to the new anchors.
- `01-product-decisions.html`, `04-test-plan.html`, `index.html`: new **Operating Procedures**
  section in 01 (`#operating-procedures`); CSP smoke test + tests for the two new endpoints in 04;
  index cards updated.

If those edits are missing, the pre-fix snapshot of all five docs is at
`/private/tmp/claude-501/-Users-peach-Documents-popo-juristic-platform/a8e6b2a2-384a-47c4-9b05-d49ed1b7d937/scratchpad/serve/`
(session-scoped; may be gone) — the docs in `docs/` are the source of truth either way.

## Where the work lives

- Workflow script: `docs/_work/workflow/juristic-platform-docs.js` (v1 before the test-reuse patch:
  `juristic-platform-docs.v1.js`)
- Run id: `wf_c8a91bd5-8e3`; journal (every agent's return value): `docs/_work/workflow/journal.jsonl`
- Intermediate outputs: `docs/_work/parts/`
  - `decisions.json` — PM decision log (binding for all later agents)
  - `adr.md` — Architecture Decision Record (binding technical names/stack)
  - `arch-lean.md`, `arch-robust.md` — architecture proposals (the Codex Sol proposal and review did
    not produce output; both fell back to the two Opus proposals / two Opus review lenses)
  - `eng/*.html`, `design/*.html`, `design/tokens.css`, `test/*.html` — section fragments before assembly

## Viewing the docs

Open `docs/index.html` in a browser. Mermaid loads from jsDelivr, so diagrams need internet.
For a local server: `cd docs && python3 -m http.server 8765` then http://127.0.0.1:8765/

## Verification checklist

- No `{{` placeholders in any `docs/*.html`
- `<section` count equals `</section>` count per file
- In a browser console: `document.querySelectorAll('pre.mermaid svg').length === document.querySelectorAll('pre.mermaid').length`
- Demo numbers consistent everywhere: room 205, 30 sqm, water 10 u × 18 = 180, elec 70 u × 8 = 560,
  common 30 × 35 = 1,050, total 1,790 THB, due 5 Sep 2026, paid 3 Sep 2026, receipt REC-202609-000852
