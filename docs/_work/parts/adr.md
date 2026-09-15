# ADR-001 — Juristic Platform: system architecture

**Status:** Accepted · **Date:** 2026-09-07 · **Decider:** Principal engineer (architecture judge)
**Scope:** binding for every downstream document — engineering spec, UI/UX design, test plan, user manual, runbook.
**Inputs:** PRD §1–§30 · PM decision log D-01…D-47 (binding) · two independent architecture proposals (Lean, Robust).

This ADR is the single source of truth. Where it and a proposal disagree, this ADR wins. Where it and the PM decision log disagree, the decision log wins except at the five points explicitly marked **ENG-n**, which are mechanism corrections that preserve the decided policy — each one is named, justified and flagged so a reviewer can find it.

> **Transcription note for HTML writers.** Fenced code blocks below carry real `<`, `>` and `&` so SQL and JS are copy-pasteable. When a downstream document reproduces them inside `<pre><code>`, escape those three characters. Mermaid blocks below already avoid them.

---

## 0. Verdict

**Winner: Proposal 2 (Robust).** It is right about the things that cost days to retrofit and cannot be tested into existence later: money arithmetic executed in SQL on `DECIMAL`, `dateStrings` on the pool, the one-Active-tenant rule enforced by the database rather than by a service, a stored retry key, and an integration tier that actually exercises the races that lose money.

**Grafted from Proposal 1 (Lean), because Robust over-builds in five places:** no migration framework (a committed `schema.sql` + `seed.sql` rebuilt from empty), no `csrf-sync` dependency (a 25-line synchronizer-token helper), no `repos/` layer (services own their own SQL), no `supertest` (Node's own `fetch` plus a 15-line cookie helper), and one `dedupe_key` generated column instead of two `COALESCE` columns.

**Corrected in both:** `previous_period` must be `VARCHAR(8)` — Robust's `VARCHAR(7)` truncates the literal `'baseline'`, which is the value D-06 puts in that column for every room's first month.

Scoring is in §9.

---

## 1. Final stack

Ten runtime dependencies, three dev dependencies, zero build step, one deployable process. `package-lock.json` is committed; `npm ci` is what reproduces a build. The versions below are floors pinned at kickoff — a minor bump is routine, a major bump is a decision.

| Layer | Choice | Version | Why |
|---|---|---|---|
| Runtime | Node.js (Active LTS) | `24.x` (`engines: ">=24 <25"`) | One language for pages, jobs and the LINE client. `fetch`, `node:test`, `--env-file` and `Intl` are built in — that is four dependencies deleted. |
| HTTP framework | Express | `^5.1` | Named by PRD §23 and fixed by D-43. Express 5 forwards async handler rejections to the error middleware, so a forgotten `try/catch` in a money path surfaces as a logged 500 instead of a hung request. |
| Views | EJS, server-rendered | `^3.1.10` | D-43 forbids a separate frontend build. Thai copy (D-02, D-31) is written where it is read. |
| Client JS | Plain ES modules from `/public`, no bundler | — | Four interactive surfaces only: per-room reading save (D-15), send-drain loop (D-19), change calculator (D-24), announcement preview count (D-35). ~200 lines total. |
| Charts | Chart.js from cdnjs | `4.5.x` | PRD §23, D-41's four charts. A `<script>` tag, no toolchain. |
| Database | MySQL (LTS) | `8.4` (minimum `8.0.16` for `CHECK`) | PRD §23. D-26 is written in MySQL 8 dialect: stored generated column, `ON DUPLICATE KEY UPDATE … LAST_INSERT_ID(seq+1)`. |
| Data access | `mysql2/promise` pool, prepared statements, hand-written SQL. **No ORM.** | `^3.15` | See A-2. `mysql2` returns `DECIMAL` as a string, which is exactly what D-16 requires. |
| Schema management | Committed `db/schema.sql` + `db/seed.sql`, database rebuilt from empty | — | See A-3. |
| Session auth | `express-session` + `express-mysql-session` | `^1.18` / `^3.0` | D-37 verbatim. A free instance restarts; memory sessions log everyone out mid-demo. |
| Password hashing | `bcryptjs`, cost 10 | `^3.0` | D-37 fixes bcrypt cost 10. The pure-JS build is the same algorithm with no native toolchain on a free host. |
| Validation | `zod` | `^4` | One schema per endpoint produces both the 422 payload and the Thai inline field message of D-40 from one definition. |
| LINE SDK | `@line/bot-sdk` | `^10` | `validateSignature` and the explicit 400 that D-30 keys auto-unbinding on are the two places a hand-rolled client fails silently. Push, multicast (D-34) and reply come with it. |
| Security headers | `helmet` | `^8` | CSP allowing only cdnjs (Chart.js) and Google Fonts. |
| Login rate limit | `express-rate-limit` | `^8` | D-37: 10 failed logins per IP per 15 minutes, with `app.set('trust proxy', 1)`. |
| CSRF | Own 25-line synchronizer token (`middleware/csrf.js`) | — | `csurf` is deprecated; a session-stored random token compared with `crypto.timingSafeEqual` is smaller than any package that wraps it. Unit tested. |
| Scheduler | External cron (cron-job.org free) → two schedules | — | D-32: no `node-cron`; an in-process timer never fires on a sleeping instance. Render Cron Jobs are the paid fallback D-32 allows. |
| Print | `window.print()` on a dedicated A5 route + print stylesheet | — | D-28 verbatim. No PDF library, no Thai font embedding problem. |
| CSV export | 15-line shared helper, UTF-8 with BOM | — | D-42's four exports ship already-shaped rows. |
| Thai baht in words | Own `lib/thaiBaht.js` | — | D-27 names it a deliverable with a required unit test. |
| Dates & money formatting | `Intl` (`th-TH-u-ca-gregory-nu-latn`, `Asia/Bangkok`) | stdlib | The `-u-ca-gregory` keyword is D-03's "never Buddhist Era" rule expressed once. No `dayjs`, no `date-fns`. |
| Logging | 10-line `lib/log.js`, JSON to stdout | — | Render captures stdout. |
| Lint / format | ESLint flat config + Prettier + `eslint-config-prettier` | `^9` / `^3` | Two config files, no plugins. |
| Tests | `node:test` + `node:assert/strict` + built-in `fetch` | stdlib | Zero test dependencies, zero config. See §6.9. |
| Web hosting | Render free web service | — | D-43: one fixed HTTPS origin for the webhook, for the life of the project. |
| DB hosting | Aiven free managed MySQL 8 (Clever Cloud as alternate) | — | D-43. Connection string in env vars. |
| CI | GitHub Actions: `npm run lint && npm test` against a MySQL 8.4 service container | — | Nothing else. No coverage gate. |

**Language: JavaScript (ESM), not TypeScript.** No build step for server or client, matching D-43. Type safety where it matters comes from `zod` at the trust boundary and `DECIMAL` in the schema — a compiler cannot validate a meter reading a human typed.

**Explicitly rejected dependencies:** any ORM (A-2), a migration framework (A-3), `csurf`, `csrf-sync`, `dotenv`, native `bcrypt`, `moment`/`dayjs`/`date-fns`, any PDF library, any logging framework, Jest/Vitest/Playwright, `supertest`, React/Next.js (A-1), Vercel (D-43), Redis, any queue or broker.

---

## 2. Architecture and deployment topology

### 2.1 Runtime architecture

<div class="diagram">
<pre class="mermaid">
flowchart LR
  ADM["Admin browser, desktop 1280px"]
  STF["Staff browser, phone 360px"]
  TEN["Tenant, LINE app"]
  CRON["cron-job.org, two schedules"]
  LP["LINE Messaging API"]

  subgraph RENDER["Render free web service, one Node 24 process"]
    MW["Middleware chain: helmet, static, session, CSRF, auth, role"]
    PAGES["EJS page routes"]
    API["JSON routes under /api"]
    HOOK["POST /line/webhook, signature, ACK 200 first"]
    JOB["POST /internal/jobs/daily, X-Job-Token"]
    HZ["GET /healthz"]
    SVC["Services: billing, payment, notify, linking, reports, audit"]
  end

  DB[("MySQL 8.4 managed: app data and session store")]

  ADM --> MW
  STF --> MW
  MW --> PAGES --> SVC
  MW --> API --> SVC
  SVC --> DB
  TEN --> LP
  LP --> HOOK --> SVC
  SVC -->|"push and multicast"| LP
  LP --> TEN
  CRON -->|"daily 09:00 Asia/Bangkok"| JOB --> SVC
  CRON -->|"every 10 minutes"| HZ
</pre>
<div class="caption">One process, one database, two inbound integrations. Nothing is scheduled inside the process and no state lives in process memory.</div>
</div>

**Request path, in order.** `helmet` → `express.static('/public')` (before the session, so assets never touch MySQL) → `express-session` (MySQL store, `httpOnly`, `SameSite=Lax`, `Secure` in production, rolling 8h) → `csrf` (issue on GET, verify on every POST) → `requireAuth` → `requireRole('admin'|'staff')` → `zod` parse → route handler → exactly one service call → EJS render or JSON → `middleware/errors.js` as the last handler.

**Three routes bypass the chain, each with its own authentication** (D-29, D-32, D-37): `POST /line/webhook` (`X-Line-Signature`), `POST /internal/jobs/daily` (`X-Job-Token`), `GET /healthz` (public, one `SELECT 1`). The login rate limiter never applies to these three.

**Transaction rule.** A service opens a transaction for anything that changes money or bill state, writes its audit row on the *same connection* (D-38), commits, and only then talks to LINE. A LINE timeout can never roll back a payment (D-30).

### 2.2 Deployment topology

<div class="diagram">
<pre class="mermaid">
flowchart TB
  DEV["Student laptop: node --watch, local MySQL"]
  GH["GitHub repo: source, schema.sql, seed.sql, mysqldump milestones"]
  RND["Render free web service, one fixed HTTPS origin, env vars only"]
  AIV["Aiven free MySQL 8.4"]
  CJ["cron-job.org: 09:00 daily job, 10-minute healthz ping"]
  LOA["LINE Official Account, Messaging API channel"]
  PRN["Office printer, A5 portrait"]

  DEV -->|"git push"| GH
  GH -->|"auto deploy on main"| RND
  RND -->|"TLS, connection string in env"| AIV
  CJ --> RND
  RND -->|"push and multicast"| LOA
  LOA -->|"webhook to the fixed origin"| RND
  RND -->|"browser print dialog"| PRN
  GH -.->|"demo-day fallback: local app plus local MySQL from seed.sql"| DEV
</pre>
<div class="caption">Everything on the critical path is free. Secrets live only in Render environment variables and a password-protected team note, never in the repo (D-43).</div>
</div>

**Environments.** Two: local (`.env`, local MySQL, LINE test mode ON, webhook disabled) and production (Render + Aiven, LINE test mode ON by default per D-34, switched off only for the rehearsed demo). There is no staging environment — a third environment is a third place for the webhook URL to be wrong.

**Environment variables** (`.env.example` is committed, values are not): `DATABASE_URL`, `SESSION_SECRET`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `JOB_TOKEN`, `SEED_ADMIN_PASSWORD`, `TZ=Asia/Bangkok`, `NODE_ENV`.

**Two cron schedules, deliberately separate** (D-32, D-43): `POST /internal/jobs/daily` at 09:00 Asia/Bangkok, and `GET /healthz` every 10 minutes. The daily job is not a keep-alive — a once-a-day request keeps a Render free instance awake for about a minute, not a day.

**Recovery.** `schema.sql` + `seed.sql` rebuild the entire graded demo from an empty database in one command; a `mysqldump` is committed before every milestone and the day before the demo. Documented demo-day fallback: the same app run locally against local MySQL restored from `seed.sql`, webhook disabled, test mode on.

---

## 3. Domain model

18 tables. Surrogate primary key `id BIGINT UNSIGNED AUTO_INCREMENT` on every table unless stated. `FLOAT` and `DOUBLE` appear nowhere in the schema (D-16). Every foreign key is declared and indexed.

### 3.1 Entity relationships

<div class="diagram">
<pre class="mermaid">
erDiagram
  users ||--o{ meter_readings : records
  users ||--o{ payments : receives
  rooms ||--o{ tenants : houses
  rooms ||--o{ meter_readings : has
  rooms ||--o{ bills : billed
  tenants ||--o{ bills : owes
  tenants ||--o{ link_codes : invited
  tenants ||--o{ notifications : receives
  bills ||--|{ bill_items : contains
  bills ||--o{ payments : settled_by
  payments ||--|| receipts : issues
  announcements ||--o{ notifications : broadcasts
</pre>
<div class="caption">The billing spine. Six further tables carry no meaningful relationships to draw: settings, rates, counters, job_runs, line_followers, audit_log, sessions.</div>
</div>

### 3.2 Tables and key fields

| Table | Key fields | Constraints and notes |
|---|---|---|
| `users` | `username` VARCHAR(50), `display_name` VARCHAR(100), `password_hash` CHAR(60), `role`, `status`, `created_at` | `UNIQUE(username)`. `display_name` is what prints as ผู้รับเงิน on the receipt (D-27, D-46). Never deleted, only Inactive. |
| `settings` | `id` fixed 1, `apartment_name`, `address`, `tax_id` NULL, `phone`, `office_hours`, `due_day` TINYINT, `line_test_mode` TINYINT(1) DEFAULT 1, `line_test_user_id` NULL | `CHECK (id = 1)`, `CHECK (due_day BETWEEN 1 AND 28)`. One property, one building (D-04). `tax_id` optional — the letterhead omits the line when empty (D-27). Test mode defaults ON in every environment (D-34). |
| `rooms` | `room_code` VARCHAR(10), `floor` TINYINT, `room_type` VARCHAR(20) NULL, `area_sqm` DECIMAL(6,2), `baseline_water` INT UNSIGNED, `baseline_electric` INT UNSIGNED, `baseline_date` DATE, `status`, `is_active` TINYINT(1) DEFAULT 1 | `UNIQUE(room_code)`. `floor` is entered, never parsed from the code (D-47). Baselines live here, never as a synthetic reading row (D-06). `status` is maintained by the tenant transaction, never independently editable (D-07). Deactivated, not deleted, once a bill references it (D-47). |
| `tenants` | `room_id`, `full_name`, `phone` CHAR(10), `move_in_date` DATE, `move_out_date` DATE NULL, `status`, `line_user_id` VARCHAR(64) NULL, `line_display_name` NULL, `line_linked_at` TIMESTAMP NULL, `active_room_id` generated | `active_room_id BIGINT UNSIGNED AS (IF(status='Active', room_id, NULL)) STORED`, `UNIQUE(active_room_id)` — **ENG-1**, at most one Active tenant per room (D-10). `UNIQUE(id)` already gives D-29's per-tenant LINE binding by construction, so there is no `line_accounts` table. Never deleted. |
| `link_codes` | `tenant_id`, `code` CHAR(6), `expires_at` TIMESTAMP, `used_at` TIMESTAMP NULL | `UNIQUE(code)`. Alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 7 days, single use (D-29). |
| `line_followers` | `line_user_id` VARCHAR(64) PK (natural key), `display_name`, `followed_at`, `unfollowed_at` NULL | Written by the `follow` event so the code-matching step has a name to show (D-29). |
| `meter_readings` | `room_id`, `period` CHAR(7), `utility_type`, `previous_reading` INT UNSIGNED, `current_reading` INT UNSIGNED, `units` INT UNSIGNED, `previous_period` VARCHAR(8), `meter_replaced` TINYINT(1), `old_final` NULL, `new_start` NULL, `replace_reason` NULL, `recorded_by`, `recorded_at` | `UNIQUE(room_id, period, utility_type)` — a double submit is an UPSERT (D-12). `CHECK (units >= 0)` (D-13). `previous_period` holds `'baseline'` or `YYYY-MM`, hence **VARCHAR(8)**, not 7. **No status column** — see §3.4. |
| `rates` | `utility_type`, `unit_price` DECIMAL(8,2), `effective_from` DATE, `created_by`, `created_at` | `UNIQUE(utility_type, effective_from)`. Insert-only; a rate row is never UPDATEd (D-17). |
| `bills` | `room_id`, `tenant_id`, `period` CHAR(7), `room_code_snapshot`, `room_area_sqm` DECIMAL(6,2), `tenant_name_snapshot`, `total` DECIMAL(10,2), `status`, `due_date` DATE, `approved_by` NULL, `approved_at` TIMESTAMP NULL | `UNIQUE(room_id, period)` — the idempotency key of the whole billing run (D-18). Three snapshot columns make a reprint reproducible with no versioning tables (D-09). `Overdue` is never stored (D-21). |
| `bill_items` | `bill_id`, `item_type`, `quantity` DECIMAL(10,2), `unit_price` DECIMAL(8,2), `amount` DECIMAL(10,2), `previous_reading` NULL, `current_reading` NULL, `previous_period` VARCHAR(8) NULL | `UNIQUE(bill_id, item_type)` — **ENG-2**, makes a fourth or duplicate item impossible. Exactly three rows per bill, always, even at 0 units and 0.00 (D-18, D-41). |
| `payments` | `bill_id`, `amount` DECIMAL(10,2), `paid_at` TIMESTAMP, `received_by_user_id`, `method`, `voided_at` NULL, `voided_by` NULL, `void_reason` NULL, `active_bill_id` generated | `active_bill_id BIGINT UNSIGNED AS (IF(voided_at IS NULL, bill_id, NULL)) STORED`, `UNIQUE(active_bill_id)` (D-26 — binding, must not be "simplified" into `UNIQUE(bill_id)`). Never deleted (D-25). |
| `receipts` | `payment_id`, `receipt_no` VARCHAR(20), `issued_at` TIMESTAMP, `print_count` INT DEFAULT 0, `voided_at` NULL | `UNIQUE(payment_id)`, `UNIQUE(receipt_no)`. Voided, never deleted, so the number stays taken (D-25, D-27). |
| `counters` | `name` VARCHAR(20) PK (natural key), `seq` BIGINT UNSIGNED | One row, `name='receipt'` (D-26). |
| `announcements` | `title` VARCHAR(60), `body` VARCHAR(400), `audience`, `audience_floors` VARCHAR(50) NULL, `created_by`, `sent_at` TIMESTAMP | Immutable once sent (D-35). `audience_floors` is a comma-separated floor list, used only when `audience='floors'`. |
| `notifications` | `type`, `bill_id` NULL, `announcement_id` NULL, `tenant_id`, `recipient_user_id` VARCHAR(64) NULL, `status`, `attempt_count` INT DEFAULT 0, `retry_key` CHAR(36), `last_error` NULL, `http_status` NULL, `last_attempt_at` NULL, `send_date` DATE, `dedupe_key` generated | `dedupe_key VARCHAR(80) AS (CONCAT_WS(':', type, IFNULL(bill_id,0), IFNULL(announcement_id,0), tenant_id, send_date)) STORED`, `UNIQUE(dedupe_key)` — **ENG-3**. One row per recipient, never per API call (D-30). |
| `audit_log` | `entity_type`, `entity_id`, `bill_id` NULL, `action`, `actor_user_id`, `before_json` JSON NULL, `after_json` JSON NULL, `reason` NULL, `created_at` | Index on `(bill_id, created_at)` so Bill Detail's timeline is one query with no join (D-38). |
| `job_runs` | `job_name`, `run_date` DATE, `started_at`, `finished_at` NULL, `summary_json` NULL | `UNIQUE(job_name, run_date)` (D-32). |
| `sessions` | managed by `express-mysql-session` | D-37. Not touched by application code. |

### 3.3 Enum values — exhaustive and binding

Casing follows the decision log verbatim and is deliberately **not** normalised: D-02's `data-status` test hook and D-31's template keys are already written this way, and renaming them for tidiness would break test selectors and template lookups.

| Enum | Column | Values |
|---|---|---|
| Role | `users.role` | `admin`, `staff` — no third role, no per-user permission table (D-36) |
| User status | `users.status` | `Active`, `Inactive` (D-46) |
| Room status | `rooms.status` | `Occupied`, `Vacant` (D-07) |
| Tenant status | `tenants.status` | `Active`, `Inactive` (D-10) |
| Bill status (stored) | `bills.status` | `Draft`, `Unpaid`, `Paid` (D-21) |
| Bill status (display) | derived, never stored | `Draft`, `Unpaid`, `Paid`, `Overdue` (D-21) |
| Reading utility | `meter_readings.utility_type` | `water`, `electric` |
| Rate utility | `rates.utility_type` | `water`, `electric`, `common` |
| Bill item type | `bill_items.item_type` | `water`, `electric`, `common` |
| Payment method | `payments.method` | `cash` — one value; the column exists because PRD §12 and D-24 name วิธีชำระเงิน on the receipt |
| Notification type | `notifications.type` | `BILL`, `BILL_CORRECTED`, `PRE_DUE`, `OVERDUE`, `PAID`, `ANNOUNCEMENT` (D-31) |
| Notification status | `notifications.status` | `queued`, `sent`, `failed`, `skipped_no_line` (D-30) |
| Announcement audience | `announcements.audience` | `all`, `floors` (D-35) |
| Job name | `job_runs.job_name` | `daily`, `daily_manual` (D-32) |
| Audit action | `audit_log.action` | `BILL_APPROVE`, `BILL_REVERT`, `PAYMENT_CONFIRM`, `PAYMENT_VOID`, `RATE_CHANGE`, `ROOM_CREATE`, `ROOM_EDIT`, `ROOM_AREA_CHANGE`, `ROOM_DEACTIVATE`, `READING_CREATE`, `READING_EDIT`, `METER_REPLACEMENT`, `TENANT_LINE_LINK`, `TENANT_LINE_UNLINK`, `TENANCY_END`, `ANNOUNCEMENT_SEND` |

Two notes on the audit list. D-38 says "exactly these twelve" and then lists thirteen entries — the count is the slip, not the list; all thirteen are audited. `TENANCY_END` is added (**ENG-5**): D-39 requires a Thai reason on the สิ้นสุดสัญญาเช่า dialog, and `audit_log.reason` is the only place that reason can be stored. Collecting a reason and discarding it is a defect, so the action is audited.

### 3.4 There is no reading status

`meter_readings` has no status column and no state machine. A reading's editability is *derived* from its room's bill for that period: editable while that bill is `Draft` or does not exist, frozen otherwise (D-12). Storing it would create a second source of truth that a revert (D-22) would have to keep in sync. There is likewise no period state machine and no `closed` state anywhere in the system (D-11).

---

## 4. Bill state machine

Three stored statuses, four displayed.

<div class="diagram">
<pre class="mermaid">
stateDiagram-v2
  [*] --> Draft: generation run creates the bill, D-18
  Draft --> Draft: reading edited, bill recalculated in place, D-12
  Draft --> Unpaid: "อนุมัติและส่งบิล, admin only, freezes the bill and sets due_date, D-19 D-20 D-22"
  Unpaid --> Paid: "ยืนยันรับเงินสด, admin only, issues the receipt, D-24 D-26"
  Unpaid --> Draft: "ตีกลับเป็นฉบับร่าง, admin only, reason required, newest bill for the room only, D-22"
  Paid --> Unpaid: "ยกเลิกการชำระเงิน, admin only, cash returned across the counter first, D-25"
  Paid --> [*]
  note right of Unpaid
    Overdue is a DISPLAY value only.
    Unpaid plus due_date in the past renders Overdue.
    Nothing writes it, no job produces it, it adds no charge.
  end note
</pre>
<div class="caption">Two reverse edges, both Admin-only, both requiring a Thai reason of at least 10 characters, both audited inside the transaction that makes the change.</div>
</div>

**The one display-status helper**, in two languages and nowhere else (D-21):

```sql
CASE WHEN b.status = 'Unpaid' AND b.due_date < CURDATE()
     THEN 'Overdue' ELSE b.status END AS display_status
```

```js
export const billStatus = (b) =>
  b.status === 'Unpaid' && b.due_date < todayBangkok() ? 'Overdue' : b.status;
```

Aggregations that deliberately mean "approved" (D-41's money tiles reading `status IN ('Unpaid','Paid')`) or "not yet settled" (D-42's arrears ageing) read the stored column directly. That is not a violation: D-21 is a display rule.

**Guards on every edge, enforced server-side, not by a disabled button.**

| Edge | Guard |
|---|---|
| → `Draft` (create) | `UNIQUE(room_id, period)`; room is billable per D-07; both readings present |
| `Draft` → `Unpaid` | role `admin`; `UPDATE … WHERE id = ? AND status = 'Draft'`; `due_date = MAX(due_day of the period month, approval_date + 3 days)`, clamped to the month's last day (D-20); one notifications row per bill queued in the same transaction |
| `Unpaid` → `Paid` | role `admin`; `UPDATE bills SET status='Paid' WHERE id = ? AND status = 'Unpaid'` — 0 rows affected returns 409 `บิลนี้ถูกชำระไปแล้ว`; `UNIQUE(active_bill_id)`; `UNIQUE(receipts.payment_id)` |
| `Unpaid` → `Draft` | role `admin`; reason ≥ 10 chars; refused when a later bill exists for the room: `SELECT 1 FROM bills WHERE room_id = ? AND period > ? LIMIT 1` (D-22) |
| `Paid` → `Unpaid` | role `admin`; reason ≥ 10 chars; payment and receipt marked voided, never deleted; the bill is thereafter excluded from automatic `PRE_DUE`/`OVERDUE` sends (D-25, D-33) |

---

## 5. Folder layout

One repository, one deployable. The "frontend" is `views/` + `public/`; there is no second build, no second package.json and no second deploy target.

### 5.1 Backend

```
juristic-platform/
├─ server.js                  app wiring, middleware order, graceful shutdown
├─ package.json               10 runtime deps, 3 dev deps, "start": "node server.js"
├─ package-lock.json          committed
├─ eslint.config.js
├─ .env.example               names only, never values
├─ db/
│  ├─ pool.js                 mysql2 pool: timezone '+07:00', dateStrings, decimalNumbers off
│  ├─ tx.js                   withTx(fn) — the only place BEGIN/COMMIT/ROLLBACK appears
│  ├─ schema.sql              every table, key, CHECK and generated column, in one readable file
│  └─ seed.sql                D-44 demo data, every date computed from CURDATE()
├─ middleware/
│  ├─ auth.js                 requireAuth, requireRole — the D-36 matrix, one enforcement point
│  ├─ csrf.js                 25-line synchronizer token, issue and verify
│  ├─ validate.js             zod schema -> 422 in the standard envelope
│  └─ errors.js               last handler: the one error shape, Thai 403 and 500 pages (D-40)
├─ routes/                    HTTP only: parse, call one service, render or respond
│  ├─ auth.js  dashboard.js  rooms.js  tenants.js  users.js  settings.js
│  ├─ readings.js             list, per-room save, generation trigger (D-15, D-18)
│  ├─ bills.js                list, detail, approve, revert, invoice print (D-19, D-22, D-28)
│  ├─ payments.js             confirm, void (D-24, D-25)
│  ├─ receipts.js             A5 view, print-count increment (D-27)
│  ├─ announcements.js        compose, preview count, send (D-35)
│  ├─ reports.js              four reports plus CSV (D-42)
│  ├─ line.js                 POST /line/webhook — raw body, signature, ACK 200 first (D-29)
│  └─ internal.js             POST /internal/jobs/daily, GET /healthz (D-32, D-43)
├─ services/                  transactions, business rules AND their SQL. No req/res in here.
│  ├─ billing.js              previous-reading and rate resolution, generate, recalculate, approve, revert
│  ├─ payment.js              confirm, void, receipt-number allocation (D-24..D-27)
│  ├─ notify.js               enqueue, drain, retry, test-mode redirect, templates dispatch (D-30..D-35)
│  ├─ linking.js              link codes, webhook event handling (D-29)
│  ├─ jobs.js                 the daily job body (D-32, D-33)
│  └─ reports.js              the four report queries and the Dashboard formulas (D-41, D-42)
├─ lib/
│  ├─ money.js                formatting only — money arithmetic happens in SQL (D-16)
│  ├─ datetime.js             Intl th-TH-u-ca-gregory, period helpers, todayBangkok()
│  ├─ thaiBaht.js             amount in words, integer and satang forms (D-27)
│  ├─ billStatus.js           the one JS display-status helper (D-21)
│  ├─ templates.js            the seven Thai LINE templates, braced placeholders only (D-31)
│  ├─ csv.js                  UTF-8 with BOM export helper (D-42)
│  ├─ audit.js                audit(conn, {...}) — always the transaction's connection (D-38)
│  ├─ schemas.js              zod schemas, one per endpoint, Thai messages
│  ├─ errors.js               AppError and the standard envelope
│  └─ log.js
└─ test/
   ├─ unit/                   money, dates, thaiBaht, billStatus, previous reading, due date, rates
   ├─ integration/            the races that lose money, against a scratch schema
   └─ helpers/                db setup, 15-line fetch client that keeps the session cookie
```

**The layering rule, enforced in review, is one sentence:** routes do HTTP, services do transactions and rules and their own SQL, `lib/` is pure functions. A `req` object never reaches a service; a SQL string never appears in a route.

### 5.2 Frontend (server-rendered, inside the same repo)

```
views/
├─ layout.ejs                 shell: header (apartment name + Juristic Platform), nav from the role matrix
├─ partials/
│  ├─ nav.ejs  flash.ejs  empty-state.ejs  confirm-dialog.ejs  status-badge.ejs
│  ├─ money.ejs  pagination.ejs  skeleton.ejs
├─ pages/
│  ├─ login.ejs  dashboard.ejs  rooms.ejs  room-detail.ejs  tenants.ejs
│  ├─ readings.ejs  bills.ejs  bill-detail.ejs  payment.ejs  receipt.ejs
│  ├─ announcements.ejs  reports/*.ejs  settings.ejs  users.ejs
│  └─ errors/403.ejs  errors/404.ejs  errors/500.ejs
└─ print/
   ├─ receipt.ejs             A5, ใบเสร็จรับเงิน (D-27)
   └─ invoice.ejs             A5, ใบแจ้งค่าใช้จ่าย — same layout, no receipt number (D-28)

public/
├─ css/app.css                design tokens, layout, components
├─ css/print.css              @page { size: A5 portrait; margin: 10mm }
├─ js/readings.js             per-room save + counter (D-15)
├─ js/send-drain.js           the approve result screen's drain loop (D-19)
├─ js/payment-change.js       รับเงิน / เงินทอน, screen only, never sent (D-24)
├─ js/announcement-preview.js live preview and recipient count (D-35)
├─ js/charts.js               Chart.js bootstrap from /api/dashboard/charts (D-41)
└─ js/confirm-dialog.js       the six call sites (D-39)
```

---

## 6. Conventions

### 6.1 Naming

| Thing | Rule | Example |
|---|---|---|
| Tables | `snake_case`, plural | `meter_readings`, `bill_items` |
| Columns | `snake_case`, singular | `previous_reading`, `received_by_user_id` |
| Foreign keys | `<singular_table>_id` | `bill_id`, `actor_user_id` |
| Generated columns | `<meaning>` + the constraint that needs them | `active_bill_id`, `active_room_id`, `dedupe_key` |
| Indexes | `uq_<table>_<cols>` / `ix_<table>_<cols>` | `uq_bills_room_period` |
| Page routes | lowercase, plural, hyphenated | `/bills`, `/bills/:id`, `/readings`, `/announcements` |
| JSON routes | `/api/<resource>[/<action>]` | `/api/bills/approve` |
| JS files and functions | `camelCase` functions, `kebab-case` public assets, `camelCase` server modules | `billStatus()`, `send-drain.js` |
| EJS locals | `snake_case` when they mirror a column, `camelCase` when computed | `due_date`, `displayStatus` |
| Test hooks | `data-status="Draft|Unpaid|Paid|Overdue"` on every element rendering a status (D-02) | — |

Page identifiers stay English in routes, code, payloads and tests; every visible string is Thai (D-02).

### 6.2 API style and base path

**Server-rendered pages with POST-Redirect-GET are the default.** A form POST goes to the page's own path and redirects on success; on failure it re-renders with the typed values preserved and an inline Thai error (D-40) — never a redirect, never a lost form.

**JSON lives under `/api`, with no version segment.** There is one deployment and no external consumer; `/api/v1` would be a version nobody will ever bump. Exactly seven JSON endpoints exist, and adding an eighth is a decision, not a convenience:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/readings` | per-room reading save, returns the room's saved state and the X/Y counter (D-15) |
| POST | `/api/bills/generate` | generation run for a period, returns the D-18 summary counts |
| POST | `/api/bills/approve` | bulk approve, one transaction, returns the result summary (D-19) |
| POST | `/api/notifications/drain` | push at most 20 queued rows, returns running counts (D-19) |
| GET | `/api/dashboard/charts?period=YYYY-MM` | the four chart series (D-41) |
| POST | `/api/receipts/:id/print` | increment `print_count` before `window.print()` (D-27) |
| GET | `/api/announcements/preview-count` | live `{rooms}` / `{linked}` count (D-35) |

Three non-`/api` machine endpoints, each with its own authentication: `POST /line/webhook`, `POST /internal/jobs/daily`, `GET /healthz`.

### 6.3 JSON envelope and error format

Every JSON response has **exactly one top-level key**: `data` or `error`. No response ever carries both, and no endpoint returns a bare array.

```json
{ "data": { "period": "2026-09", "created": 1, "updated": 0, "skipped": 0, "unread": 3 } }
```

```json
{ "error": {
    "code": "READING_BELOW_PREVIOUS",
    "message": "เลขมิเตอร์ปัจจุบันน้อยกว่าเดือนก่อน (1,250) กรุณาตรวจสอบ",
    "fields": { "current_reading": "ต้องไม่น้อยกว่า 1,250" } } }
```

`code` is a stable `UPPER_SNAKE` identifier the tests assert on; `message` is Thai and is what the user sees; `fields` is present only for validation failures and is keyed by input name.

| Status | Meaning | Example |
|---|---|---|
| 400 | Malformed request, unparseable body | missing `period` |
| 401 | No session | expired cookie on a JSON call |
| 403 | Role denied — HTML gets the Thai 403 page with a button back to จดมิเตอร์ (D-40) | staff opening a bill URL |
| 404 | Not found | unknown bill id |
| 409 | Lost a state race | `บิลนี้ถูกชำระไปแล้ว` (D-26) |
| 422 | Well-formed but rejected by a business rule | current reading below previous (D-13) |
| 500 | Unexpected — generic Thai sentence, stack to stdout only | — |

### 6.4 Money

- Types: money `DECIMAL(10,2)`, rates `DECIMAL(8,2)`, area `DECIMAL(6,2)`, readings and units `INT UNSIGNED`. `FLOAT`/`DOUBLE` are forbidden schema-wide (D-16).
- **JavaScript never multiplies, sums or rounds money.** Item amounts are computed in SQL at generation time: `amount = ROUND(quantity * unit_price, 2)`, half-up, stored rounded. The bill total is the SQL sum of the already-rounded items, so a printed receipt always equals the sum of its printed lines. There is no second rounding at the total, no rounding to whole baht, no satang suppression.
- The pool sets `decimalNumbers` off, so `mysql2` returns `DECIMAL` as a string and no amount ever passes through a JS float.
- `lib/money.js` formats and nothing else: `1,790.00` in tables, on Bill Detail and on the receipt; `1,790 บาท` (trailing `.00` dropped) in LINE messages and sentence text; `฿1,790` only in this documentation set and in static mockups (D-03). Money columns are right-aligned with `font-variant-numeric: tabular-nums`.

### 6.5 Time

- The process runs with `TZ=Asia/Bangkok`; every pooled connection runs `SET time_zone = '+07:00'` (D-03).
- **Instants use `TIMESTAMP`** — `created_at`, `paid_at`, `recorded_at`, `approved_at`, `issued_at`, `last_attempt_at`, `line_linked_at`, `expires_at`. MySQL stores `TIMESTAMP` internally as UTC and converts on read using the session time zone, so storage is UTC and every read is already Asia/Bangkok wall time. That satisfies both halves of the rule at once, with no conversion code anywhere. Accepted limitation: `TIMESTAMP` ends in 2038, which no capstone reaches.
- **Business dates use `DATE`** and carry no timezone at all: `due_date`, `baseline_date`, `move_in_date`, `move_out_date`, `effective_from`, `send_date`, `run_date`.
- `dateStrings: true` on the pool, so a `DATE` arrives as `'2026-09-05'` and cannot be shifted by a JS `Date` constructor.
- **No UTC is ever shown to a user, and no date arithmetic happens in the browser.**
- Display goes through `lib/datetime.js` only: `Intl.DateTimeFormat('th-TH-u-ca-gregory-nu-latn', { timeZone: 'Asia/Bangkok' })`. The `-u-ca-gregory` keyword is load-bearing — plain `th-TH` renders Buddhist Era, which D-03 forbids. Lists and forms use `3 ก.ย. 2026`; LINE messages and the receipt use `3 กันยายน 2026`; times are 24-hour with the suffix `น.` (`14:30 น.`).

### 6.6 Identifiers

- Surrogate `id BIGINT UNSIGNED AUTO_INCREMENT` on every table except `counters` (`name`) and `line_followers` (`line_user_id`), which have meaningful natural keys.
- No UUIDs anywhere except `notifications.retry_key`, which is a `CHAR(36)` UUID because LINE requires that shape.
- Only two identifiers are ever shown to a human: `rooms.room_code` (VARCHAR(10), unique, `205` today and `A-205` tolerated) and `receipts.receipt_no` (`REC-YYYYMM-NNNNNN`).

### 6.7 Dates, periods and API payloads

- Billing period: `CHAR(7)`, `YYYY-MM`, e.g. `2026-09`. String ordering is chronological, which is what makes D-14's `ORDER BY period DESC` free and index-friendly. There is no periods table and no open/close state (D-11).
- `meter_readings.previous_period` and `bill_items.previous_period` are `VARCHAR(8)` and hold either a period or the literal `'baseline'` (D-06). **Not `VARCHAR(7)`** — that truncates `'baseline'`.
- Every API payload and every database value uses ISO 8601 dates (`2026-09-03`). Thai formatting happens at render time only.

### 6.8 Validation, in four layers

1. **Form** — `inputmode="numeric"`, `min`, `required`, and D-13's live check that disables Save when the current reading is below the previous. Convenience only.
2. **`zod` at the boundary** — every route parses `req.body`/`req.query` before the handler body runs; Thai messages come from the schema, so the API message and the inline form message are the same string.
3. **Services** — the rules that need the database: one Active tenant, billable-room test, end-of-tenancy gating (D-08), revert-newest-only (D-22), meter-replacement arithmetic.
4. **The database has the last word** — `CHECK (units >= 0)`, `CHECK (due_day BETWEEN 1 AND 28)`, `CHECK (id = 1)` on settings, and the unique keys `uq_readings(room_id, period, utility_type)`, `uq_bills(room_id, period)`, `uq_bill_items(bill_id, item_type)`, `uq_payments(active_bill_id)`, `uq_tenants(active_room_id)`, `uq_receipts(payment_id)`, `uq_receipts(receipt_no)`, `uq_notifications(dedupe_key)`, `uq_job_runs(job_name, run_date)`, `uq_rates(utility_type, effective_from)`, plus foreign keys everywhere.

Layer 4 is the one that still holds under a race, under a handler that forgot a check, and under a student running an UPDATE by hand. Layers 1–3 exist to give a human a good message.

### 6.9 Testing

Three tiers, run by `node --test`, no framework, no coverage gate.

1. **Unit, no database** — where the project's actual business logic lives: `thaiBaht()` over 0 / 1,790.00 / 1,790.50 / 1,000,000.00 (D-27, a named deliverable); previous-reading resolution over fixtures (baseline, normal, skipped month, late entry, upsert self-exclusion); meter-replacement units and its two validations (D-13); item rounding and total-equals-sum-of-items (D-16); rate resolution by period including a mid-period effective date (D-17); the `MAX(due day, approval + 3)` rule with the short-month clamp (D-20); `billStatus()` agreeing with the SQL expression on the same fixtures (D-21); receipt-number formatting; the CSRF token compare. The PRD §28 arithmetic — 10 × 18 = 180, 70 × 8 = 560, 30 × 35 = 1,050, total 1,790 — is one test that must never go red.
2. **Integration, scratch schema, driven by built-in `fetch` plus a 15-line cookie helper** — the races that lose money: double Confirm Cash Payment → one payment, one receipt, second call 409; void then re-pay → new receipt number, old number still held; generation run twice → `สร้างใหม่ 0`, Drafts recalculated, approved bills untouched; approve twice → no second batch of messages; daily job twice in a day → second call a no-op, and the manual trigger after it still sends nothing twice; concurrent receipt allocation → no duplicate number; the notification dedupe key rejecting a same-day repeat; revert on a bill with a later bill → refused server-side; and one test per staff-forbidden route asserting 403 **and** that no amount appears anywhere in a staff response body (D-36).
3. **Rehearsal script** — runs `seed.sql`, then walks the demo path end to end with LINE test mode ON: read room 205 → generate → approve → drain → confirm payment → receipt issued → both notification rows recorded. It asserts the arithmetic, never the calendar (D-44). This is what runs before every push and on the morning of the defence.

---

## 7. Key mechanisms

### 7.1 Previous-reading resolution

One code path, no special cases (D-06, D-14):

```sql
SELECT current_reading, period
  FROM meter_readings
 WHERE room_id = ? AND utility_type = ? AND period < ?   -- strictly earlier
 ORDER BY period DESC
 LIMIT 1;
```

If a row comes back it is `previous_reading` / `previous_period`. If nothing comes back, the room's `baseline_water` / `baseline_electric` applies with `previous_period = 'baseline'`.

Why this is correct and cheap: `period` is `CHAR(7)`, so string order is chronological; ordering is by `period` and never by `recorded_at`, so a month entered late resolves exactly as it would have on time; ties are impossible under `uq_readings`; the row being written is excluded by the strict `<`, so an UPSERT can never take itself as its own previous (which is what makes D-12's double submit harmless); baselines live on the room, so no synthetic row can collide with the first real reading; gaps are legal and never block a run.

`previous_reading` and `units` are snapshots computed at save time. That is precisely why D-22 restricts reverting to a room's most recent bill — editing an older month would leave the next month's snapshot stale. The revert endpoint enforces it with a query, not a disabled button.

Meter replacement is the single branch (D-13): with the checkbox ticked, `units = (old_final − previous_reading) + (current_reading − new_start)`, validated as `old_final >= previous_reading AND current_reading >= new_start`, which keeps `units >= 0` and satisfies the `CHECK`.

### 7.2 Rate versioning and resolution

`rates` is append-only and effective-dated; a Settings save INSERTs and never UPDATEs (D-17). Resolution is keyed to the **period**, not to the moment generation was clicked:

```sql
SELECT unit_price
  FROM rates
 WHERE utility_type = ?
   AND effective_from <= CONCAT(?, '-01')   -- first day of the bill's period month
 ORDER BY effective_from DESC
 LIMIT 1;
```

The resolved price is copied onto the `bill_items` row with the quantity, and every screen, print view and LINE message renders from that snapshot. Consequences: every bill in one period carries the same rate however often generation re-runs; a rate changed today never disturbs an approved bill; the Dashboard tiles are explainable against a single figure. If Draft bills exist for a period when a rate back-dated into it is saved, Settings shows `มีบิลฉบับร่าง {N} ใบในรอบนี้ ยังใช้อัตราเดิมอยู่` with a `คำนวณบิลฉบับร่างใหม่` button that recalculates Draft bills only.

### 7.3 Bill generation idempotency

`UNIQUE(room_id, period)` is the idempotency key of the entire run (D-18). One run, inside one transaction per room:

1. creates a Draft bill for every billable room (D-07: `status='Occupied'` **and** exactly one Active tenant, guaranteed unique by ENG-1) that has both readings and no bill;
2. recalculates in place every existing **Draft** bill for the period;
3. never touches a bill that is `Unpaid` or `Paid`;
4. always writes exactly three `bill_items` — water, electric, common — even at 0 units and 0.00 (D-18, D-41), which is what makes the tiles sum, the receipt print three lines and D-42's split columns never null;
5. returns `สร้างบิลใหม่ {a} ใบ · อัปเดต {b} ใบ · ข้าม (อนุมัติแล้ว) {c} ใบ · ยังไม่ได้จด {d} ห้อง`.

Rooms missing readings are excluded, never zero-billed, and are surfaced in D-23's persistent warn banner. Approval is never blocked by them. Saving a corrected reading recalculates that room's Draft bill immediately.

### 7.4 Receipt numbering

Allocated inside the payment transaction, after the conditional status update succeeds (D-26, D-27):

```sql
INSERT INTO counters (name, seq) VALUES ('receipt', 1)
  ON DUPLICATE KEY UPDATE seq = LAST_INSERT_ID(seq + 1);
SELECT LAST_INSERT_ID();
```

`receipt_no = 'REC-' + <payment month YYYYMM> + '-' + String(seq).padStart(6, '0')` → `REC-202609-000852`. One continuous counter that never resets; the `YYYYMM` is a label, not a scope. The statement is atomic and the read-back is connection-local, so two cashiers can never receive the same number.

The sequence is **unique and monotonic but not gapless** — a rolled-back transaction consumes a number, and the seed starts at an offset to reproduce the PRD's own 852. No document, rationale or test may claim gaplessness. The two assertions are: no two receipts share a number, and a later payment never receives a lower one.

### 7.5 LINE account linking

Messaging API webhook plus a one-time code — no LIFF, no app, no staff typing a `userId` (a tenant cannot read their own `userId` anywhere in LINE, so this is the only self-service path).

<div class="diagram">
<pre class="mermaid">
sequenceDiagram
  autonumber
  participant A as Admin
  participant App as "Express app"
  participant DB as MySQL
  participant T as Tenant
  participant L as "LINE platform"
  A->>App: "สร้างรหัสผูก LINE for the tenant of room 205"
  App->>DB: "INSERT link_codes, 6 chars, 7 days, single use"
  App-->>A: "printable slip with the code and the OA QR"
  T->>L: "adds the Official Account as a friend"
  L->>App: "follow event"
  App-->>L: "200 first, then process"
  App->>DB: "upsert line_followers with userId and display name"
  T->>L: "sends the 6 character code as a chat message"
  L->>App: "message event"
  App-->>L: "200 first, then process"
  App->>DB: "match code, bind userId to the tenant, expire the code, audit"
  App->>L: "reply LINK_OK naming the room"
  L->>T: "binding confirmed"
</pre>
<div class="caption">The webhook ACKs before doing any work (D-29, D-43): LINE disables an endpoint that repeatedly fails to answer, and a disabled webhook silently kills the only channel by which a userId ever reaches the system.</div>
</div>

Mechanics: `POST /line/webhook` is mounted with `express.raw({ type: 'application/json' })` **before** the JSON body parser, because `validateSignature` needs the exact bytes. A bad signature is 401 and nothing else happens. The SDK's `middleware()` is **not** used — it processes handlers before responding, which is the behaviour being avoided.

Uniqueness is on the **tenant**, not the LINE account (D-29): one `userId` may be bound to two Active tenants (a parent renting two rooms), every template names the room, and a bill for each room writes its own notifications row. A wrong or expired code gets `LINK_FAIL`; anything else gets one fixed auto-reply — the OA is not a chatbot.

**ENG-4:** `LINK_OK`, `LINK_FAIL` and the auto-reply are sent with the **Reply API** using the event's reply token, and write no `notifications` row. D-34 lists link replies under "Push"; replying to an inbound message is what D-29 actually describes, reply messages do not consume the 500-message allowance, and the quota counter is unchanged either way because it counts `notifications` rows with `status='sent'`. Policy identical, mechanism corrected.

### 7.6 Idempotent sends

Five layers, each closing a different failure, all of them in the database rather than in a process:

1. **`UNIQUE(dedupe_key)`** (**ENG-3**) — one message type per bill (or announcement) per tenant per day, whatever calls the code. D-30 specifies `UNIQUE(type, bill_id, announcement_id, tenant_id, send_date)`; that index cannot enforce the rule, because InnoDB treats NULLs as distinct and exactly one of `bill_id`/`announcement_id` is always NULL, so every duplicate would be accepted. The fix uses the same mechanism family D-26 already establishes: `dedupe_key VARCHAR(80) AS (CONCAT_WS(':', type, IFNULL(bill_id,0), IFNULL(announcement_id,0), tenant_id, send_date)) STORED` with a unique index on it. Same semantics, working mechanism. Every attempt UPSERTs that row.
2. **`attempt_count`** — automatic retries stop at 3; the Admin's per-bill manual `ส่งแจ้งเตือนอีกครั้ง` is never capped, because it is the tool of last resort on exactly the day an automatic send failed (D-30, D-33).
3. **`X-Line-Retry-Key`**, a UUID stored on the row at enqueue time and reused on every attempt for that row — LINE deduplicates retries carrying the same key, which closes the one gap the table cannot close on its own: a push that succeeded at LINE but whose result was lost before it could be recorded.
4. **`SELECT GET_LOCK('notif_drain', 0)`** held for the length of one drain batch and released in a `finally`, so the approve result screen and the daily job cannot push the same queued rows concurrently. The dedupe key stops a duplicate *row*; only this stops two workers pushing the same row twice. Held for at most 20 pushes. If a provider blocks `GET_LOCK`, the fallback is `SELECT id FROM notifications … FOR UPDATE SKIP LOCKED` inside the drain transaction.
5. **`UNIQUE(job_name, run_date)`** on `job_runs` — a retrying scheduler cannot run the day twice (D-32). The manual demo button deliberately bypasses this layer (`job_name='daily_manual'`, no `job_runs` check) and relies on layer 1, so a 14:00 demo still works after the 09:00 cron ran.

Two further rules that matter more than they look: **sends happen after the commit, never inside the transaction** (D-30), and **LINE test mode defaults ON in every environment** (D-34), redirecting every outbound message to one whitelisted `userId` while still recording the intended recipient on the row. Combined with the seed's `Useed…` placeholder IDs — which D-30's auto-unbind skips — a stray send during development cannot damage the seeded state.

Delivery choice (D-34): **Push** for everything personalised, one call per recipient; **Multicast** in chunks of at most 500 `userId`s for announcements, one `notifications` row per recipient regardless; **Broadcast never**, because it would reach every OA follower including ex-tenants. Settings shows `ส่งข้อความเดือนนี้: {N}/500`, where N counts `notifications` rows with `status='sent'` in the current month, in warn colour above 450. Nothing is throttled.

### 7.7 Scheduler

<div class="diagram">
<pre class="mermaid">
sequenceDiagram
  autonumber
  participant C as "cron-job.org"
  participant App as "POST /internal/jobs/daily"
  participant DB as MySQL
  participant L as "LINE Messaging API"
  C->>App: "09:00 Asia/Bangkok, X-Job-Token"
  App->>DB: "INSERT job_runs, unique on job_name and run_date"
  alt already ran today
    App-->>C: "200, no-op"
  else first run today
    App->>DB: "Unpaid bills where due_date minus today equals 2, queue PRE_DUE"
    App->>DB: "Unpaid bills where days_overdue in 1, 8, 15, queue OVERDUE"
    App->>DB: "exclude Paid bills and bills whose latest payment was voided"
    App->>DB: "GET_LOCK notif_drain, then drain queued and retry failed below 3"
    loop each queued row
      App->>L: "push with the row's retry key"
      App->>DB: "upsert sent or failed, attempt_count plus one"
    end
    App-->>C: "200 with the summary counts"
  end
  C->>App: "GET /healthz every 10 minutes, separate schedule"
</pre>
<div class="caption">At most four automatic messages per bill for its entire life (D-33). The job never writes a bill status — Overdue is derived (D-21).</div>
</div>

The job also drains anything a bulk approval left queued (D-19) and retries `failed` rows below `attempt_count = 3`. Settings carries the Admin button `รันงานแจ้งเตือนตอนนี้`, which calls the identical code path with `job_name='daily_manual'`, skips the `job_runs` guard entirely, and reports `ส่งแจ้งเตือนก่อนครบกำหนด {a} ราย · เลยกำหนด {b} ราย · ส่งซ้ำที่ล้มเหลว {c} ราย`.

### 7.8 Bulk approve — two round trips

Approval and delivery are separate calls (D-19, D-45 target 4). `POST /api/bills/approve` commits every selected bill to `Unpaid` in one transaction — freezing the bill, computing the frozen due date, writing the audit row and queuing one notifications row per bill — and returns in under five seconds. The result screen then calls `POST /api/notifications/drain` repeatedly, each call pushing at most 20 messages and returning running counts, so no request exceeds roughly twenty seconds and a dropped connection loses nothing: the queued rows survive and the 09:00 job would finish them anyway.

---

## 8. Decisions, rationale, rejected alternatives

**A-1 · Server-rendered EJS on one long-lived Express process; no SPA, no build step.**
*Rationale:* D-43 fixes it, and it is right on the merits — the only genuinely interactive surfaces are the phone reading round, the drain loop, the change calculator and the announcement preview, roughly 200 lines of plain JS. A SPA adds a build, a state layer and a second deploy target for no user-visible gain, in a semester that has to ship twelve screens.
*Rejected:* React/Next.js on Vercel (PRD §23 lists it) — serverless cannot give the LINE webhook one stable long-lived endpoint, which is a hard requirement of D-29 and D-43; a bundler for "just the reading page"; TypeScript, which would reintroduce the build step D-43 removes.

**A-2 · `mysql2` with hand-written SQL; no ORM.**
*Rationale:* The four hardest guarantees in the decision log are SQL constructs — a stored generated column with a unique index (D-26), `ON DUPLICATE KEY UPDATE seq = LAST_INSERT_ID(seq+1)` (D-26), the greatest-effective-date rate lookup (D-17) and the display-status `CASE` (D-21). Each is one clear statement and an awkward ORM escape hatch. Prepared-statement placeholders make injection safety something a reviewer can check by grepping for string concatenation, and the students already know SQL from coursework.
*Rejected:* Prisma and Sequelize — each adds a schema language, a generate/migrate step and a translation layer between what the decision log specifies and what reaches the database; Knex — a query builder for queries that are already the clearest thing in the codebase.

**A-3 · Committed `db/schema.sql` + `db/seed.sql`, rebuilt from empty; no migration framework, no `schema_migrations`.**
*Rationale:* There is no production data to preserve, and D-43/D-44 already require a committed seed that recreates the graded demo in one command. The schema is a thesis artifact that examiners read; one readable file beats fourteen numbered fragments. This is the one place the Robust proposal over-built.
*Rejected:* a numbered migrations folder plus a 30-line runner (Robust) — real value only once data must survive a schema change, which is the trigger to add it mid-semester if it ever arrives; Prisma Migrate, which requires A-2's ORM.

**A-4 · Money arithmetic executes in SQL on `DECIMAL`; JavaScript formats only.**
*Rationale:* D-16 says JavaScript never does money arithmetic on a total it can recompute. The strongest version of that is a schema where JS *cannot* — `mysql2` returns `DECIMAL` as a string, `ROUND(quantity * unit_price, 2)` happens in the INSERT, the total is a SQL `SUM` of already-rounded rows, and `lib/money.js` has no arithmetic in it at all. This is the single largest correctness difference between the two proposals.
*Rejected:* `decimal.js` or `big.js` in a `lib/money.js` (Lean's implied shape) — a dependency and a second rounding site to keep in agreement with the database; float arithmetic anywhere, which is the 1789.9999999 class of demo-day defect.

**A-5 · `TIMESTAMP` for instants, `DATE` for business dates, `dateStrings: true`, `time_zone = '+07:00'`.**
*Rationale:* MySQL stores `TIMESTAMP` as UTC and converts on read with the session time zone, so storage is UTC and every read is already Asia/Bangkok — both halves of the requirement with zero conversion code. `DATE` columns carry no timezone, and `dateStrings` stops a JS `Date` constructor shifting `due_date` across a day boundary, which would move a bill into Overdue a day early on the one screen that matters.
*Rejected:* `DATETIME` for instants (Lean) — no UTC storage and no conversion, so the rule would live only in a convention; storing epoch integers; any date library.

**A-6 · Two roles, one middleware, and money absent from staff responses rather than hidden in the template.**
*Rationale:* D-36. Hiding a column in EJS while shipping the amount in the JSON is a defect with a test against it — the staff room list and reading screens are served by queries that do not select amounts or rates at all. Navigation is generated from the same matrix so a link cannot exist for a page the role cannot open.
*Rejected:* a permissions table; a third role; template-level hiding.

**A-7 · Three layers — routes, services, `lib` — and no `repos/`.**
*Rationale:* A repository module per table would be a passthrough for eight of the eleven tables and an abstraction with exactly one implementation. The rule that actually prevents the mess is enforceable without it: routes do HTTP, services do transactions and rules and their own SQL, `lib/` is pure functions. `req` never reaches a service; SQL never appears in a route.
*Rejected:* Robust's four-layer `routes → services → repos → db` — real value at a team size and table count this project does not have; a `models/` folder, which is A-2's ORM wearing a different name.

**A-8 · 25-line CSRF synchronizer token in `middleware/csrf.js`.**
*Rationale:* `csurf` is deprecated and unmaintained. The mechanism is a random token in the session compared with `crypto.timingSafeEqual` against a hidden input — smaller than the package that would wrap it, unit tested, and explainable in the defence.
*Rejected:* `csurf` (deprecated); `csrf-sync` (Robust) — a dependency for twenty-five lines; double-submit cookies without a session component, which is weaker for no saving.

**A-9 · `node:test` plus built-in `fetch` and a 15-line cookie helper; no `supertest`, no Jest, no Playwright.**
*Rationale:* Node 24 ships the runner, the assertion library and an HTTP client. The only thing `supertest` adds is a cookie jar, which the login helper is fifteen lines of. What matters is the *list* of tests in §6.9, not the harness — Robust was right about the list and wrong about needing a dependency to run it.
*Rejected:* `supertest`; Jest or Vitest (a config file and a transform for a project with no build step); Playwright (a browser download and a week of setup in a semester that needs the twelfth screen).

**A-10 · Correctness lives in the database: eleven unique keys, three generated columns, three `CHECK`s.**
*Rationale:* Every guard listed in §6.8 layer 4 still holds under a race, under a handler that forgot a check, and under a hand-typed UPDATE. ENG-1 (`active_room_id`) makes D-10's one-Active-tenant rule true by construction, which is what lets D-07's billable-room test read an unambiguous state and lets bill generation join a single tenant without a `LIMIT 1` that could silently pick the wrong one. Together these are perhaps thirty lines of SQL and they are the difference between a demo that survives a double-click in front of an examiner and one that does not.
*Rejected:* enforcing uniqueness in a service with a `SELECT` then an `INSERT` (a race with a guaranteed loser); application-level advisory locks as the primary guard; trusting the disabled button.

**A-11 · JSON under `/api` with no version segment; page forms use POST-Redirect-GET.**
*Rationale:* One deployment, no external consumer, and seven JSON endpoints that exist only where a page must not reload. A version segment would be a number nobody bumps. POST-Redirect-GET is what makes D-40's "re-render with the typed values preserved" the natural failure path instead of a special case.
*Rejected:* `/api/v1` (speculative); a JSON API for every action with the pages calling it (doubles the surface and makes every form a fetch); REST purity — `POST /api/bills/approve` is an action, and naming it one is clearer than modelling approval as a resource.

**A-12 · The LINE binding is three columns on `tenants`; there is no `line_accounts` table.**
*Rationale:* D-29 keys uniqueness to the tenant, which the tenant's own primary key satisfies by construction. PRD §21's `LineAccounts` entry is descriptive, not normative. One table and one join deleted, and the "one `userId`, two rooms" case works with no extra code.
*Rejected:* a separate `line_accounts` table with `UNIQUE(tenant_id)` — the same constraint, one more join on every send.

**A-13 · Recorded assumptions.**
1. Versions in §1 are floors at kickoff (September 2026); `package-lock.json` plus `npm ci` reproduce the build.
2. `bcryptjs` substitutes for native `bcrypt` — same algorithm, same cost 10 (D-37), no compiler on the deploy host.
3. `GET_LOCK` is available on the managed MySQL; the documented fallback is `FOR UPDATE SKIP LOCKED`.
4. `X-Line-Retry-Key` is settable on the pinned SDK major; if not, it is set through the SDK's HTTP config, and if that fails, layers 1, 2, 4 and 5 still stand.
5. The A5 print output is verified on a real office printer by week 9. Browser print CSS is the one part of this stack that cannot be unit tested.
6. One process is enough — every acceptance number in D-45 is a single-instance figure, and every guard above lives in the database anyway, so a second instance would not break correctness.
7. PRD §12's grant of Confirm Cash Payment to เจ้าหน้าที่ is a drafting error; §4 and D-36 win, and every document flags it. This is the single place a decision overrides literal PRD text.
8. PRD §16's 18,500 and 62,500 and PRD §19's 35 ตร.ม. row are illustrative and are never used as expected values in a seed or a test (D-44).
9. Nothing in this ADR reintroduces a PRD §24 exclusion: no rent, no lease contracts, no mobile app, no payment gateway, no cards, no online banking, no slip upload, no QR payment, no IoT or automatic meters, no AI/ML. Payment is cash at the counter; the only automation is the reminder job and the LINE messages.

**A-14 · Agreed cut order, decided now rather than in week 14.**
The demo path is never cut: Login → จดมิเตอร์ → generate → อนุมัติและส่งบิล → LINE BILL → ยืนยันรับเงินสด → receipt with its number and print view → LINE PAID → the Dashboard money tiles. Cut in this order if the semester runs short: (1) report 4, ห้องที่ใช้น้ำ/ไฟสูงสุด; (2) CSV export on all four reports, screens kept; (3) two of the four dashboard charts, keeping 12-month water units and 12-month revenue; (4) floor-scoped announcement audience, shipping `ทุกห้องที่มีผู้เช่า` only; (5) report 3, ประวัติรายห้อง 12 เดือน; (6) the meter-replacement branch, keeping the hard block on current-below-previous; (7) the soft usage flags; (8) the Bill Detail audit timeline UI, keeping the `audit_log` writes; (9) bulk approve, keeping Bill Detail's single approve — but only if the daily job survives, since it is the delivery safety net.
**Never cut, in any circumstance:** the eleven unique keys and three generated columns of §6.8 layer 4; the audit rows on approve, payment and void; LINE test mode defaulting ON; the derived Overdue helper; `seed.sql`. Each costs days to retrofit and each is a class of bug that stays invisible until it has already produced a wrong number.

---

## 9. Scoring

Both proposals are competent and cite the decision log correctly; they differ in where they spend complexity. Scores are 1–5, higher is better.

| Criterion | Weight | P1 — Lean | P2 — Robust | Notes |
|---|---|---:|---:|---|
| Fit to PRD + decision log | ×2 | 4 | 5 | P2 closes three gaps the log leaves open (one-Active-tenant enforcement, exactly-three-items enforcement, retry key) and gets `previous_period` wrong at `VARCHAR(7)`; P1 gets that column right but leaves D-10 to application code and flirts with violating D-16 by putting DECIMAL arithmetic in `lib/money.js`. |
| Buildability by 3–4 students in one semester | ×2 | 5 | 4 | P1's ten deps, flat layout and no migration runner are genuinely lighter. P2 adds a migration runner, a `repos/` layer, `csrf-sync` and `supertest` — four things to learn that ship no screen. |
| Correctness of billing and money handling | ×3 | 3 | 5 | Decisive. P2 puts the arithmetic in SQL, sets `dateStrings`, enforces one-Active-tenant in the schema, and tests the races with a named list. P1 leaves rounding in JS and one-Active-tenant in a service. |
| LINE integration soundness | ×2 | 4 | 5 | Both ACK 200 first and both fix D-30's unenforceable unique key. P2 additionally *stores* the retry key (so a retry reuses it) and locks the drain, closing the double-push a shared queue actually has. |
| Operational simplicity and hosting cost | ×2 | 5 | 4 | Identical hosting (free Render + free MySQL + free cron). P1 has fewer moving parts to operate: no migration state, no CI service container required to run tests. |
| Demo-friendliness | ×1 | 5 | 5 | Both rebuild the graded demo from a committed seed with relative dates and both keep a rehearsal script on the demo path. |
| **Weighted total** | | **47** | **53** | |

**Winner: Proposal 2 (Robust)**, on the two axes that cannot be recovered later — money correctness and LINE delivery integrity. Its excess complexity is recoverable, and this ADR recovers it: the migration runner, the `repos/` layer, `csrf-sync` and `supertest` are all removed in favour of Proposal 1's simpler answers (A-3, A-7, A-8, A-9), Proposal 1's single `dedupe_key` column replaces two `COALESCE` columns, and Proposal 1's correct `VARCHAR(8)` for `previous_period` replaces Proposal 2's truncating `VARCHAR(7)`. The result keeps Robust's database and money guarantees at Lean's dependency count: ten runtime dependencies, three dev dependencies, one process, one database, zero build steps.
