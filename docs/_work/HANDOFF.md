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
