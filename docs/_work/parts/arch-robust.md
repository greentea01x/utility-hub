# Architecture Proposal — Juristic Platform

**Owner:** Principal Software Engineer · **Status:** Proposed · **Basis:** PRD §1–§30, PM decision log D-01 – D-47

This proposal turns the PRD and the 47 binding product decisions into a buildable system. The governing bias is **correctness of money and bill state first**: every rule that protects a baht is enforced by a database constraint or a single shared helper, never by a screen. The second bias is **buildable by 3–4 students in one semester**: one process, one language, one database, no build step, no framework the team has to learn twice.

Where the decision log already fixes a choice, this document cites it and adds only the mechanism. Where the log leaves a mechanism open, this document decides and marks the decision `ENG-n` so reviewers can find the additions. Assumptions are listed in §8.

---

## 1. Tech stack

### 1.1 Choices

| Layer | Choice | Pin | One-line rationale |
|---|---|---|---|
| Runtime | Node.js LTS | `24.x` in `engines` (22.x also fine) | One language across server, jobs and browser glue; Render's default runtime; `--env-file` removes the `dotenv` dependency. |
| Web framework | Express | `^5.1` | D-43 fixes a single long-lived Express process; Express 5 forwards rejected promises from handlers to the error middleware, so a forgotten `try/catch` in a money path becomes a 500 with a stack trace instead of a silent hang. |
| Views | EJS server-rendered + vanilla JS | `ejs ^3.1` | D-43 forbids a separate frontend build. Plain HTML forms mean a dropped connection loses one form, not a client-side store; the phone reading screen needs `fetch` in exactly one place (D-15). |
| Database | MySQL 8 (managed free tier) | `8.0.x` | PRD §23; D-26 depends on MySQL 8 stored generated columns and `LAST_INSERT_ID(expr)`, D-16 on `DECIMAL`, and 8.0.16+ enforces `CHECK`. |
| Query layer | `mysql2/promise` + hand-written SQL in a repository module. **No ORM.** | `mysql2 ^3.11` | D-26's generated column + `ON DUPLICATE KEY UPDATE seq = LAST_INSERT_ID(seq+1)`, D-17's greatest-effective-date lookup and D-21's `CASE` status expression are all raw SQL; an ORM would be a layer to fight, not a layer to learn. `mysql2` also returns `DECIMAL` as a **string**, which is exactly what D-16 wants. |
| Migrations | numbered `.sql` files + ~30-line runner recording `schema_migrations` | — | The schema is the thesis artifact; students must be able to read it. No migration framework earns its weight at 18 tables. |
| Auth | `express-session` + `express-mysql-session`, `bcryptjs` cost 10 | `^1.18`, `^3.0`, `bcryptjs ^3` | D-37 fixes sessions in MySQL (a free instance restarts; memory sessions log everyone out). `bcryptjs` over native `bcrypt`: no compiler on the deploy host, and at 2–5 users the speed difference is irrelevant. |
| CSRF | `csrf-sync` (session-backed synchronizer token) | `^4` | `csurf` is deprecated; `csrf-sync` is the same idea, maintained, and pairs with the session we already have. Fallback if it stalls: ~20 lines of our own token + `crypto.timingSafeEqual`. |
| Validation | `zod` | `^4` | One schema per endpoint, Thai messages from the schema, parsed **before** the handler. Runtime validation is what actually stops a bad meter reading; TypeScript would not. |
| LINE SDK | `@line/bot-sdk` | `^10` | Official SDK: `messagingApi.MessagingApiClient` for push/multicast/reply and `validateSignature` for the webhook. Confirm the current major at kickoff and pin it in `package-lock.json`. |
| Scheduler | **external** cron-job.org → `POST /internal/jobs/daily` at 09:00 Asia/Bangkok; second job `GET /healthz` every 10 min | — | D-32 forbids in-process cron; D-43 makes the keep-alive its own schedule. cron-job.org is free and lets you pick Asia/Bangkok directly; Render Cron Jobs are a paid add-on, so treat them as the fallback the log allows, not the default. |
| Charts | Chart.js from CDN, fed by a JSON route | `4.x` | PRD §23 and D-41. No bundler, four chart types, done. |
| Receipt / bill printing | `window.print()` on a dedicated A5 route with `@page { size: A5 portrait; margin: 10mm }` | — | D-28 forbids a PDF library and server-side rendering. Zero dependencies, and the same route serves screen and paper. |
| Hosting | Render **free web service** | — | D-43. One stable HTTPS origin for the life of the project — the requirement Vercel's serverless model cannot meet for a LINE webhook. |
| Database hosting | Aiven for MySQL free plan (Clever Cloud as alternate) | — | D-43. **Do not** reach for PlanetScale — its free tier is gone. |
| Lint / format | ESLint 9 flat config + `eslint-config-prettier` + Prettier 3 | `^9`, `^3` | One `npm run lint`, one `npm run format`, no debate in code review. |
| Test | built-in `node:test` + `supertest` | `supertest ^7` | The runner ships with Node; `supertest` is the only new dependency and it buys HTTP-level tests of the money paths (§7.7). No Jest, no Vitest, no Playwright in v1. |
| Logging | one `lib/log.js` (~10 lines, JSON to stdout) | — | Render captures stdout. A logging library is a dependency to configure, not a problem we have. |
| Dates & money formatting | built-in `Intl` | — | `Intl.DateTimeFormat('th-TH-u-ca-gregory-nu-latn', { timeZone: 'Asia/Bangkok' })`. The `-u-ca-gregory` is load-bearing: plain `th-TH` renders **Buddhist Era**, which D-03 forbids. No `dayjs`, no `date-fns`. |

### 1.2 Deviations from PRD §23, stated plainly

- **React / Next.js → EJS + vanilla JS.** Fixed by D-43, and correct on the merits here: the only genuinely interactive surface is the phone reading round (D-15), which is one card + one `fetch` per room. A SPA would add a build, a state layer and a second deploy target for no user-visible gain.
- **ORM → raw SQL.** Justified above; the PRD names no ORM, so this is a fill-in rather than a deviation.
- **Session vs JWT → session.** D-37. A JWT cannot be revoked when Admin sets a user Inactive (D-46).
- **Vercel dropped from the deploy candidates.** D-43: the webhook needs one fixed origin and a warm-enough process; the free plan we can afford is Render.
- **`csurf`, `dotenv`, `bcrypt` (native), `moment`/`dayjs`, a PDF library, a migration framework, a logging framework, an ORM — all rejected.** Each is replaced by a built-in or by ten lines. Every dependency a student cannot explain in the defence is a liability.

---

## 2. High-level architecture

<div class="diagram">
<pre class="mermaid">
flowchart LR
  subgraph Client["Browsers"]
    A["Admin desktop 1280px"]
    S["Staff phone 360px"]
  end
  subgraph Render["Render free web service - one Node process"]
    MW["Middleware: session, CSRF, role, rate limit"]
    WEB["EJS page routes"]
    API["JSON routes: saves and chart data"]
    JOB["POST /internal/jobs/daily"]
    HOOK["POST /line/webhook"]
    SVC["Services: billing, payment, notify, audit"]
  end
  DB[("MySQL 8 managed")]
  LINE["LINE Messaging API"]
  CRON["cron-job.org"]
  A --> MW
  S --> MW
  MW --> WEB
  MW --> API
  WEB --> SVC
  API --> SVC
  JOB --> SVC
  HOOK --> SVC
  SVC --> DB
  SVC -->|"push and multicast"| LINE
  CRON -->|"daily 09:00 ICT"| JOB
  CRON -->|"GET /healthz every 10 min"| MW
  LINE -->|"follow and message events"| HOOK
</pre>
<div class="caption">One process, one database, two inbound integrations. Nothing is scheduled inside the process and no state lives in process memory.</div>
</div>

### 2.1 Request path

1. Browser → Render's TLS-terminating proxy → Express. `app.set('trust proxy', 1)` so the login rate limiter keys on the real client IP (D-37).
2. `helmet` → static assets → `express-session` (store: MySQL) → `csrf-sync` → `requireAuth` → `requireRole('admin' | 'staff')`.
3. Route handler: `zod` parses `req.body`/`req.query` first and returns the standard error envelope (§7.3) on failure. The handler never touches SQL directly; it calls a service.
4. Service: opens a transaction where the operation changes money or state, calls repository functions, writes the audit row **inside the same transaction** (D-38), commits.
5. Response: EJS page render, or JSON. Side effects that talk to LINE happen **after** the commit, never inside it (D-30).

Three routes bypass the chain, deliberately and each with its own authentication:

- `POST /line/webhook` — no session, no CSRF; authenticated by `X-Line-Signature` (D-29).
- `POST /internal/jobs/daily` — no session, no CSRF; authenticated by the `X-Job-Token` shared secret (D-32); excluded from the rate limiter.
- `GET /healthz` — public, returns `200` plus a one-query database check.

### 2.2 Where the scheduler runs

Outside the application. cron-job.org holds two schedules: the 09:00 Asia/Bangkok reminder job and a 10-minute `/healthz` ping that keeps the free instance from spinning down (D-43 — the daily job is *not* a keep-alive; a once-a-day request keeps the process up for about a minute). The job endpoint is idempotent per day through `job_runs UNIQUE(job_name, run_date)` (D-32), so a scheduler that fires twice, or a retry after a cold-start timeout, costs nothing. The Admin's manual "รันงานแจ้งเตือนตอนนี้" button calls the identical code path with `job_name='daily_manual'` and skips the `job_runs` guard entirely (D-32).

### 2.3 Where the LINE webhook lands

`POST /line/webhook`, mounted with `express.raw({ type: 'application/json' })` **before** the JSON body parser, because signature validation needs the exact bytes. The handler:

```js
const sig = req.get('X-Line-Signature');
if (!validateSignature(req.body, CHANNEL_SECRET, sig)) return res.sendStatus(401);
res.sendStatus(200);                       // ACK first (D-29, D-43)
setImmediate(() => handleEvents(JSON.parse(req.body.toString('utf8')).events));
```

Acknowledging before doing any work is not a nicety: LINE disables a webhook that repeatedly fails to answer, and a cold-started free instance can take tens of seconds. A disabled webhook silently kills the linking flow (D-29), which is the only route by which a `userId` ever reaches the system. **Do not use the SDK's `middleware()` here** — it processes handlers before the response, which is the behaviour we are avoiding. The runbook adds one line: re-verify the webhook URL in the LINE console after every deploy and before the demo (D-43).

---

## 3. Domain model

### 3.1 Entities

Fields are the load-bearing ones; timestamps and `created_by`-style columns are omitted where obvious. Types follow D-16 absolutely: **`FLOAT` and `DOUBLE` appear nowhere in this schema.**

| Entity | Key fields | Notes |
|---|---|---|
| `users` | `username` UNIQUE, `display_name`, `password_hash`, `role ENUM('admin','staff')`, `status` | `display_name` prints as ผู้รับเงิน on the receipt (D-27, D-46). Never deleted, only set Inactive (D-46). |
| `rooms` | `room_code VARCHAR(10)` UNIQUE, `floor TINYINT`, `room_type VARCHAR(20)` NULL, `area_sqm DECIMAL(6,2)`, `baseline_water/​baseline_electric INT UNSIGNED`, `baseline_date DATE`, `status ENUM('Occupied','Vacant')`, `is_active` | Floor is entered, never parsed from the code (D-47). Baselines live here, never as a synthetic reading row (D-06). No building column (D-04). |
| `tenants` | `room_id`, `full_name`, `phone`, `line_user_id` NULL, `line_display_name` NULL, `line_linked_at` NULL, `move_in_date`, `move_out_date` NULL, `status ENUM('Active','Inactive')` | One Active tenant per room, enforced in the schema — see **ENG-1**. The LINE binding is a column here, satisfying D-29's `UNIQUE(tenant_id)` by construction while allowing one `userId` across several tenants. |
| `link_codes` | `tenant_id`, `code CHAR(6)` UNIQUE, `expires_at`, `used_at` NULL | 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 7 days, single use (D-29). |
| `line_followers` | `line_user_id` PK, `display_name`, `followed_at`, `unfollowed_at` NULL | Written by the follow event so the code-matching step has a name to show (D-29). |
| `meter_readings` | `room_id`, `period CHAR(7)`, `utility_type ENUM('water','electric')`, `previous_reading`, `current_reading`, `units`, `previous_period VARCHAR(7)`, `meter_replaced`, `old_final` NULL, `new_start` NULL, `replace_reason` NULL, `recorded_by`, `recorded_at` | `UNIQUE(room_id, period, utility_type)`; `CHECK (units >= 0)` (D-12, D-13). `previous_reading`/`units` are snapshots computed at save time. |
| `rates` | `utility_type ENUM('water','electric','common')`, `unit_price DECIMAL(8,2)`, `effective_from DATE`, `created_by` | `UNIQUE(utility_type, effective_from)`. Append-only: saving a rate INSERTs, never UPDATEs (D-17). |
| `bills` | `room_id`, `tenant_id`, `period CHAR(7)`, `room_code_snapshot`, `room_area_sqm`, `tenant_name_snapshot`, `total DECIMAL(10,2)`, `status ENUM('Draft','Unpaid','Paid')`, `due_date DATE`, `approved_by`, `approved_at` | `UNIQUE(room_id, period)` — the idempotency key of the whole billing run (D-18). Three stored statuses only; Overdue is derived (D-21). |
| `bill_items` | `bill_id`, `type ENUM('water','electric','common')`, `quantity DECIMAL(10,2)`, `unit_price DECIMAL(8,2)`, `amount DECIMAL(10,2)`, `previous_reading`, `current_reading`, `previous_period` NULL | `UNIQUE(bill_id, type)` — see **ENG-2**. Every bill carries exactly three items, even at 0 units (D-18, D-41). |
| `payments` | `bill_id`, `amount`, `paid_at`, `received_by_user_id`, `method ENUM('cash')`, `voided_at` NULL, `voided_by` NULL, `void_reason` NULL, `active_bill_id` generated | `active_bill_id BIGINT UNSIGNED AS (IF(voided_at IS NULL, bill_id, NULL)) STORED`, `UNIQUE(active_bill_id)` (D-26 — binding, and not to be "simplified"). |
| `receipts` | `payment_id` UNIQUE, `receipt_no VARCHAR(20)` UNIQUE, `issued_at`, `print_count INT DEFAULT 0`, `voided_at` NULL | Voided, never deleted, so the number stays taken (D-25, D-27). |
| `counters` | `name` PK, `seq BIGINT` | One row, `name='receipt'` (D-26). |
| `announcements` | `title`, `body`, `audience_type ENUM('all','floors')`, `audience_floors`, `created_by`, `sent_at` | Immutable once sent (D-35). |
| `notifications` | `type`, `bill_id` NULL, `announcement_id` NULL, `tenant_id`, `recipient_user_id`, `status ENUM('queued','sent','failed','skipped_no_line')`, `attempt_count`, `retry_key`, `last_error`, `http_status`, `last_attempt_at`, `send_date` | One row per **recipient** (D-30). Uniqueness needs a fix — see **ENG-3**. `retry_key` — see **ENG-4**. |
| `audit_log` | `entity_type`, `entity_id`, `bill_id` NULL, `action`, `actor_user_id`, `before_json`, `after_json`, `reason`, `created_at` | Twelve audited actions, exactly (D-38). |
| `job_runs` | `job_name`, `run_date`, `started_at`, `finished_at`, `summary_json` | `UNIQUE(job_name, run_date)` (D-32). |
| `settings` | single row `id=1` with `CHECK (id = 1)`: apartment name, address, `tax_id` NULL, phone, office hours, `due_day TINYINT` 1–28, `line_test_mode`, `line_test_user_id` | D-01, D-20, D-27, D-34. `line_test_mode` defaults **ON**. |
| `sessions` | managed by `express-mysql-session` | D-37. |
| `schema_migrations` | `version` PK, `applied_at` | Written by the migration runner. |

**Relationships:** `rooms 1—N tenants` (at most one Active), `rooms 1—N meter_readings`, `rooms 1—N bills` with `UNIQUE(room_id, period)`, `bills 1—3 bill_items`, `bills 1—N payments` (at most one live), `payments 1—1 receipts`, `tenants 1—N notifications`, `announcements 1—N notifications`.

### 3.2 Engineering additions the decision log implies but does not specify

<div class="callout decision"><div class="title">ENG-1 · One Active tenant per room, enforced by the database</div>
D-10 requires it but names no mechanism. Use the same trick D-26 already establishes: <code>active_room_id BIGINT UNSIGNED AS (IF(status='Active', room_id, NULL)) STORED</code> with <code>UNIQUE(active_room_id)</code>. MySQL permits repeated NULLs in a unique index, so any number of Inactive tenants coexist with at most one Active one per room, and D-07's billable-room test can never read an ambiguous state.
</div>

<div class="callout decision"><div class="title">ENG-2 · Exactly three bill items, enforced by the database</div>
D-41 makes "every bill carries exactly three items" an invariant with its own assertion. <code>UNIQUE(bill_id, type)</code> makes a fourth or duplicate item impossible; the generation service always inserts all three in one statement, so "fewer than three" cannot arise from a partial write inside the transaction. The tester still asserts the count — the constraint removes the failure mode the assertion was written to catch.
</div>

<div class="callout warn"><div class="title">ENG-3 · D-30's notifications unique key does not work as written in MySQL</div>
D-30 specifies <code>UNIQUE(type, bill_id, announcement_id, tenant_id, send_date)</code>. MySQL treats NULLs in a unique index as distinct, and exactly one of <code>bill_id</code>/<code>announcement_id</code> is always NULL — so the index would permit unlimited duplicates and the daily-send guarantee would be silently absent. Fix, preserving D-30's semantics exactly: add two stored generated columns
<code>subject_bill BIGINT UNSIGNED AS (COALESCE(bill_id,0)) STORED</code> and <code>subject_ann BIGINT UNSIGNED AS (COALESCE(announcement_id,0)) STORED</code>, and put the unique index on <code>(type, subject_bill, subject_ann, tenant_id, send_date)</code>. Every upsert targets this key. This is the same mechanism family as D-26, so the schema stays consistent with itself.
</div>

<div class="callout decision"><div class="title">ENG-4 · Retry key on every outbound push</div>
Store <code>retry_key CHAR(36)</code> (a UUID) on the notifications row at enqueue time and send it as <code>X-Line-Retry-Key</code> on every attempt for that row. LINE deduplicates retries carrying the same key within its retention window, which closes the one gap the notifications table cannot close on its own: a push that succeeded at LINE but whose result was lost before we could record it. The daily key from D-30 remains the outer guard; the retry key is the inner one. Confirm the SDK's parameter name against the pinned version.
</div>

### 3.3 Bill state machine

<div class="diagram">
<pre class="mermaid">
stateDiagram-v2
  [*] --> Draft: generation run creates the bill
  Draft --> Draft: reading edited, bill recalculated in place
  Draft --> Unpaid: อนุมัติและส่งบิล, admin only, freezes the bill
  Unpaid --> Paid: ยืนยันรับเงินสด, admin only, issues the receipt
  Unpaid --> Draft: ตีกลับเป็นฉบับร่าง, latest bill for the room only
  Paid --> Unpaid: ยกเลิกการชำระเงิน, cash returned first
  Paid --> [*]
  note right of Unpaid
    Overdue is DERIVED, never stored.
    Display status = Overdue when
    status is Unpaid and due_date is past.
  end note
</pre>
<div class="caption">Three stored statuses, four display statuses. Every transition is Admin-only and writes an audit row inside the same transaction (D-19, D-21, D-22, D-24, D-25, D-38).</div>
</div>

The four-value display status comes from **one helper in each language and nowhere else** (D-21):

```sql
CASE WHEN status = 'Unpaid' AND due_date < CURDATE() THEN 'Overdue' ELSE status END
```

```js
export const billStatus = (b) =>
  b.status === 'Unpaid' && b.due_date < todayBangkok() ? 'Overdue' : b.status;
```

Aggregations that deliberately mean "approved" (D-41's money tiles reading `status IN ('Unpaid','Paid')`) or "not yet settled" (D-42's arrears ageing) read the stored column directly and are not violations — the rule is a display rule.

### 3.4 Rate versioning and resolution

Rates are append-only and effective-dated (D-17). Resolution is keyed to the **period**, not to the moment the button is pressed:

<div class="formula">unit_price = SELECT unit_price FROM rates WHERE utility_type = ? AND effective_from &lt;= CONCAT(period, '-01') ORDER BY effective_from DESC LIMIT 1</div>

The resolved price is copied onto `bill_items.unit_price` together with the quantity. Consequences that make this the right shape: every bill in one period carries the same rate however often generation is re-run (D-18, D-23); a rate changed today never disturbs an approved bill; and the Dashboard's ยอดค่าน้ำเดือนนี้ is explainable against a single figure. If Draft bills exist for a period when a back-dated rate is saved, Settings offers "คำนวณบิลฉบับร่างใหม่", which recalculates Draft bills only (D-17).

### 3.5 Previous-reading resolution

One code path, no special cases (D-06, D-14):

<div class="formula">previous = SELECT current_reading, period FROM meter_readings WHERE room_id = ? AND utility_type = ? AND period &lt; ? ORDER BY period DESC LIMIT 1<br>fallback = rooms.baseline_water | rooms.baseline_electric, with previous_period = 'baseline'</div>

Why this is correct and cheap:

- `period` is `CHAR(7)` in `YYYY-MM`, so string ordering **is** chronological. No date parsing, no index gymnastics.
- Ordering by `period`, never by `recorded_at`: a month entered late resolves exactly as it would have on time.
- The row being written is excluded by the strict `<`, so an UPSERT can never take itself as its own previous — which is what makes D-12's double-submit harmless.
- Ties are impossible under `UNIQUE(room_id, period, utility_type)`.
- Baselines live on the room, so no synthetic reading row can ever collide with the first real one (D-06).
- Gaps are legal. When the resolved `previous_period` is not the immediately preceding month, it is stored on the reading and the bill item, Bill Detail shows "ครอบคลุมการใช้ตั้งแต่รอบ {previous_period_th}", and the LINE bill gets the extra note line (D-14, D-31).

Because `previous_reading` is a **snapshot**, editing an old month would leave the next month's snapshot stale. That is the entire reason D-22 permits reverting only a room's most recent bill. The revert endpoint enforces it server-side, not just by disabling a button:

```sql
SELECT 1 FROM bills WHERE room_id = ? AND period > ? LIMIT 1   -- if a row exists, refuse
```

Meter replacement (D-13) is the one branch: with the checkbox ticked, `units = (old_final - previous_reading) + (current_reading - new_start)`, validated as `old_final >= previous_reading AND current_reading >= new_start`, which keeps `units >= 0` and satisfies the `CHECK`.

### 3.6 Receipt number generation

Format `REC-<payment month YYYYMM>-<6-digit sequence>` — e.g. `REC-202609-000852` — from **one continuous counter that never resets**; the `YYYYMM` is a label, not a scope (D-27). Allocation happens inside the payment transaction (D-26):

```sql
INSERT INTO counters (name, seq) VALUES ('receipt', 1)
  ON DUPLICATE KEY UPDATE seq = LAST_INSERT_ID(seq + 1);
SELECT LAST_INSERT_ID();
```

This is a single atomic statement per allocation and the read-back is connection-local, so two cashiers can never receive the same number. A rolled-back transaction consumes a number and leaves a gap. **Gaps are accepted and documented; duplicates are not** (D-05 limitation 10, D-27). The two assertions are: no two receipts share a number, and a later payment never receives a lower one.

### 3.7 Audit and notification logs

`audit_log` is written by one helper, `audit(conn, {...})`, always taking the *transaction's* connection so an audit row cannot survive a rolled-back change or vice versa (D-38). `bill_id` is set on every bill-attributable row, which makes Bill Detail's Admin-only timeline a single query with no joins:

```sql
SELECT * FROM audit_log WHERE bill_id = ? ORDER BY created_at
```

`notifications` is the delivery ledger: one row per recipient, upserted on every attempt, `attempt_count` incremented, automatic retries capped at 3 and the Admin's manual resend uncapped (D-30). It is simultaneously the per-bill delivery badge, the per-announcement result, and D-34's monthly quota count (`COUNT(*) WHERE status='sent'` for the current month) — one table, three questions, no reconciliation.

---

## 4. Key flows

### 4.1 Monthly billing — readings → generate → approve & send → LINE

<div class="diagram">
<pre class="mermaid">
sequenceDiagram
  autonumber
  participant S as Staff phone
  participant A as Admin
  participant App as Express app
  participant DB as MySQL
  participant L as LINE API
  S->>App: POST reading for room 205, water and electric
  App->>DB: resolve previous, upsert reading, recalc that Draft bill
  App-->>S: card collapses, counter now 42 of 67
  S->>App: ส่งให้นิติตรวจสอบ for the period
  App->>DB: create Draft bills, recalc existing Drafts, skip approved
  App-->>S: สร้างใหม่ a, อัปเดต b, ข้าม c, ยังไม่ได้จด d
  A->>App: อนุมัติและส่งบิล for N selected rooms
  App->>DB: one TX - set Unpaid, freeze, set due date, queue N rows
  App-->>A: result screen in under 5 seconds
  loop batches of 20 queued rows
    A->>App: POST drain the send queue
    App->>L: push with X-Line-Retry-Key, one call per recipient
    App->>DB: mark sent or failed, attempt_count plus one
    App-->>A: running counts
  end
</pre>
<div class="caption">Approval and delivery are two round trips (D-19). The commit is fast and complete on its own; the queue survives a dropped connection and the daily job would drain it anyway (D-32).</div>
</div>

Correctness notes:

- Generation is idempotent on `UNIQUE(room_id, period)` (D-18): create where absent, recalculate Drafts in place, never touch Unpaid or Paid.
- Amount arithmetic happens in SQL on `DECIMAL`, never in JavaScript — see §7.5.
- Due date is recomputed once at approval and frozen: `due_date = MAX(day-of-month of the period month, approval_date + 3 days)`, clamped to the month's last day (D-20).
- Rooms missing readings are excluded, not zero-billed; Monthly Billing shows the warn banner listing them and approval is **not** blocked (D-23).
- The whole batch commits in one transaction; the LINE sends happen after it. A LINE outage cannot roll back billing (D-30).
- The drain endpoint takes `SELECT GET_LOCK('notif_drain', 0)` on a single pooled connection for the length of the drain, so the result screen and the daily job cannot process the same queued rows concurrently. Held for one batch of at most 20 pushes; released in a `finally`.

### 4.2 Cash payment — confirm → receipt → LINE

<div class="diagram">
<pre class="mermaid">
sequenceDiagram
  autonumber
  participant A as Admin at the counter
  participant App as Express app
  participant DB as MySQL
  participant L as LINE API
  A->>App: ยืนยันรับเงินสด for room 205, period 2026-09
  App->>DB: BEGIN
  App->>DB: UPDATE bills SET status Paid WHERE id and status is Unpaid
  DB-->>App: 0 rows means บิลนี้ถูกชำระไปแล้ว, abort
  App->>DB: INSERT payment, unique active_bill_id guards a double click
  App->>DB: allocate receipt number from counters
  App->>DB: INSERT receipt, audit row, queued notification
  App->>DB: COMMIT
  App-->>A: Receipt page with พิมพ์ใบเสร็จ
  App->>L: push PAID confirmation
  App->>DB: mark the notification sent
</pre>
<div class="caption">Three independent guards against a double click: the conditional UPDATE, UNIQUE on active_bill_id, and UNIQUE on receipts.payment_id. The disabled button is a courtesy, never the guarantee (D-26).</div>
</div>

The payment amount is not an input — it is fixed at the bill total (D-24). The รับเงิน/เงินทอน aid is computed on screen and never leaves the browser. Voiding (D-25) marks the payment and receipt voided, returns the bill to Unpaid, writes the audit row with the required reason, and suppresses that bill from automatic PRE_DUE and OVERDUE sends so a tenant who already paid is never chased.

### 4.3 LINE account linking

<div class="diagram">
<pre class="mermaid">
sequenceDiagram
  autonumber
  participant A as Admin
  participant T as Tenant on LINE
  participant L as LINE platform
  participant App as Webhook route
  participant DB as MySQL
  A->>App: สร้างรหัสผูก LINE for a tenant
  App->>DB: INSERT link_code, 6 chars, 7 days, single use
  A-->>T: printed slip with the OA QR code and the code
  T->>L: adds the Official Account as a friend
  L->>App: follow event
  App-->>L: 200 immediately, then process
  App->>DB: upsert line_followers with the display name
  T->>L: sends the 6 character code as a chat message
  L->>App: message event
  App-->>L: 200 immediately, then process
  App->>DB: match code, bind userId to the tenant, expire the code
  App->>L: reply LINK_OK, naming the room
</pre>
<div class="caption">No LIFF, no app, no hand-typed user IDs. The 200-before-work rule protects the only channel by which a userId ever reaches the system (D-29, D-43).</div>
</div>

Uniqueness is on the tenant, not on the LINE account: one parent renting two rooms binds the same `userId` to two tenants, every template names the room, and a bill for each room writes its own notifications row (D-29). A wrong or expired code gets LINK_FAIL; anything else gets the single fixed auto-reply — the OA is not a chatbot.

### 4.4 Reminder and overdue scheduler

<div class="diagram">
<pre class="mermaid">
sequenceDiagram
  autonumber
  participant C as cron-job.org
  participant App as POST /internal/jobs/daily
  participant DB as MySQL
  participant L as LINE API
  C->>App: 09:00 Asia/Bangkok with X-Job-Token
  App->>DB: INSERT job_runs, unique on job_name and run_date
  alt already ran today
    App-->>C: 200, no-op
  else first run today
    App->>DB: bills due in 2 days -> PRE_DUE
    App->>DB: bills overdue 1, 8 or 15 days -> OVERDUE
    App->>DB: exclude Paid and voided-payment bills, upsert notifications
    App->>DB: GET_LOCK notif_drain, then drain queued rows
    loop each queued row
      App->>L: push with X-Line-Retry-Key
      App->>DB: sent or failed, attempt_count plus one
    end
    App-->>C: 200 with the summary counts
  end
</pre>
<div class="caption">Four automatic messages per bill in its entire life, at one hour of the day, with two independent idempotency layers (D-32, D-33). The job changes no bill status — Overdue is derived (D-21).</div>
</div>

The job also drains anything a bulk approval left queued, and retries `failed` rows until `attempt_count` reaches 3 (D-30, D-32).

---

## 5. Module and folder layout

```
juristic-platform/
├── server.js                  # express app, middleware chain, route mounting, graceful shutdown
├── package.json               # "start": "node server.js", "dev": "node --watch --env-file=.env server.js"
├── eslint.config.js
├── db/
│   ├── pool.js                # mysql2 pool: dateStrings, timezone +07:00, decimals as strings
│   ├── tx.js                  # withTransaction(fn) — ~15 lines, the only place BEGIN/COMMIT appears
│   ├── migrate.js             # applies db/migrations/*.sql in order, records schema_migrations
│   ├── migrations/            # 001_init.sql, 002_notifications.sql, ...
│   └── seed.sql               # D-44: every date relative to CURDATE(), committed, one command
├── lib/
│   ├── money.js               # formatTHB, parse; NO arithmetic — SQL owns that (D-16)
│   ├── datetime.js            # Intl th-TH-u-ca-gregory, period helpers, todayBangkok()
│   ├── thaiBaht.js            # amount in words, integer and satang forms (D-27) — unit tested
│   ├── billStatus.js          # the ONE JS display-status helper (D-21)
│   ├── schemas.js             # zod schemas, one per endpoint, Thai messages
│   ├── errors.js              # AppError + the standard error envelope
│   ├── audit.js               # audit(conn, {...}) — always the transaction's connection
│   └── log.js
├── repos/                     # SQL only, no business rules, no HTTP
│   ├── rooms.js  tenants.js  readings.js  rates.js
│   ├── bills.js  payments.js  receipts.js  notifications.js
│   └── reports.js
├── services/                  # transactions + business rules, no SQL strings, no req/res
│   ├── billing.js             # generate, recalc, approve, revert (D-17..D-23)
│   ├── payment.js             # confirm, void, receipt allocation (D-24..D-27)
│   ├── notify.js              # enqueue, drain, retry, LINE test mode (D-30..D-35)
│   ├── linking.js             # link codes, webhook events (D-29)
│   └── jobs.js                # the daily job body (D-32, D-33)
├── routes/
│   ├── auth.js  dashboard.js  rooms.js  tenants.js  readings.js
│   ├── billing.js  payments.js  receipts.js  announcements.js
│   ├── reports.js  settings.js  users.js
│   ├── line.js                # /line/webhook — raw body, signature, 200 first
│   └── internal.js            # /internal/jobs/daily, /healthz
├── middleware/
│   ├── auth.js                # requireAuth, requireRole (D-36)
│   ├── validate.js            # zod -> 422 with the standard envelope
│   └── errors.js              # last-resort handler, Thai 403 and 500 pages (D-40)
├── views/                     # EJS. layout.ejs, partials/, one folder per page
│   └── print/                 # receipt.ejs, bill.ejs — the A5 routes (D-28)
├── public/                    # css, one small js per interactive screen, Chart.js from CDN
└── test/
    ├── unit/                  # money, dates, thaiBaht, billStatus, previous-reading, due date
    ├── integration/           # supertest against a test schema: the money paths
    └── helpers/               # test db setup, login helpers
```

The layering rule is one sentence and it is enforced in review: **routes do HTTP, services do transactions and rules, repos do SQL.** A `req` object never reaches a repo; a SQL string never appears in a service.

---

## 6. Cross-cutting concerns

### 6.1 Auth and roles

Two roles on `users.role`, no permission table (D-36). `requireRole('admin')` guards every Admin route; the navigation is built from the same matrix so the menu and the middleware cannot drift. A staff user hitting an Admin URL gets the Thai 403 page, never a silent redirect, which is what makes the permission matrix testable row by row (D-40).

Money is **absent**, not hidden, from staff responses: the staff room list and reading screens are served by queries that do not select amounts or rates. Hiding a column in EJS while shipping it in the JSON would be a defect with a test against it (D-36).

Sessions: MySQL-backed, `httpOnly`, `SameSite=Lax`, `Secure` in production, rolling 8-hour expiry; logout deletes the row. `bcryptjs` cost 10. No self-service reset — Admin resets from the Users page (D-37, D-46). The seeded admin password comes from `SEED_ADMIN_PASSWORD` and seeding fails if it is unset; no password value is ever committed. Login rate limit 10 failures per IP per 15 minutes, never applied to the webhook, the job endpoint or `/healthz`.

### 6.2 Validation — three layers, deliberately

1. **Browser:** `inputmode="numeric"`, `min`, `required`, a disabled Save on a known-bad reading. Convenience only.
2. **`zod` at the boundary:** every route parses its input before the handler body runs. Thai messages come from the schema, so the API message and the inline form message are the same string.
3. **The database has the last word:** `CHECK (units >= 0)`, `UNIQUE(room_id, period, utility_type)`, `UNIQUE(room_id, period)`, `UNIQUE(bill_id, type)`, `UNIQUE(active_bill_id)`, `UNIQUE(payment_id)`, `UNIQUE(receipt_no)`, `UNIQUE(job_name, run_date)`, the notifications key from ENG-3, and foreign keys everywhere.

Layer 3 is the one that has to be right. Layers 1 and 2 give a person a good message; layer 3 is what still holds when two requests race, when a handler forgets a check, or when a student runs an UPDATE by hand.

### 6.3 Error format

One envelope for JSON, one page per class for HTML:

```json
{ "error": { "code": "READING_BELOW_PREVIOUS",
             "message": "เลขมิเตอร์ปัจจุบันน้อยกว่าเดือนก่อน (1,250) กรุณาตรวจสอบ",
             "fields": { "current_reading": "ต้องไม่น้อยกว่า 1,250" } } }
```

`400` malformed, `401` no session, `403` wrong role, `404` missing, `409` state conflict (`บิลนี้ถูกชำระไปแล้ว`), `422` validation, `500` unexpected. HTML routes render `error.message` inline above the form with **every typed value preserved** and a ลองอีกครั้ง action — never a redirect, never a lost form, and never a full-page reload on the phone reading screen (D-40). Unexpected errors log the stack server-side and show a generic Thai sentence; a stack trace never reaches a browser.

### 6.4 Idempotent LINE sends

Five layers, each closing a different failure:

1. **`UNIQUE(type, subject_bill, subject_ann, tenant_id, send_date)`** (ENG-3) — the same bill cannot receive the same message type twice in one day, whatever calls the code.
2. **`job_runs UNIQUE(job_name, run_date)`** — a scheduler that fires twice is a no-op (D-32).
3. **`GET_LOCK('notif_drain')`** — the result screen and the daily job cannot drain the same rows at once.
4. **`X-Line-Retry-Key`** (ENG-4) — a retry after an ambiguous failure is deduplicated at LINE.
5. **`attempt_count`** — automatic retries stop at 3; the Admin's manual resend is never capped, because it is the tool of last resort on exactly the day an automatic send failed (D-30, D-33).

Two further rules that matter more than they look: sends happen **after** the commit, never inside the transaction (a LINE timeout must not roll back a payment); and **LINE test mode defaults ON in every environment** (D-34), redirecting every outbound message to one whitelisted `userId` while still recording the intended recipient. It is switched off only for the rehearsed demo. Combined with the seed's `Useed…` placeholder IDs, which D-30's auto-unbind skips, a stray send during development cannot damage the seeded state.

### 6.5 Audit trail

Exactly the twelve actions in D-38, written through `audit(conn, …)` inside the changing transaction, with `before_json`/`after_json` and — where the decision requires it — a Thai reason of at least 10 characters enforced by the schema. Not audited: logins, page views, exports, Settings profile edits. There is no global audit browser in v1; the per-bill timeline on Bill Detail is the only surface.

### 6.6 Money and time

**Money.** Every amount is `DECIMAL(10,2)`; rates `DECIMAL(8,2)`; area `DECIMAL(6,2)`; readings and units `INT UNSIGNED`. `FLOAT`/`DOUBLE` are forbidden schema-wide (D-16). **JavaScript never multiplies money.** Bill items are computed in SQL at generation time:

```sql
INSERT INTO bill_items (bill_id, type, quantity, unit_price, amount, ...)
VALUES (?, 'water', ?, ?, ROUND(? * ?, 2), ...)
```

MySQL's `ROUND` on `DECIMAL` is exact half-up, which is the rule D-16 states. The bill total is the sum of the already-rounded items — no second rounding, so the printed receipt always equals the sum of its printed lines. `mysql2` returns `DECIMAL` as a string, so a value never passes through a float on the way to the screen; `lib/money.js` formats and never computes.

**Time.** `TZ=Asia/Bangkok` on the process; `SET time_zone = '+07:00'` on every pooled connection; `dateStrings: true` in the pool so `DATE` columns arrive as `'2026-09-05'` and cannot be shifted by a JavaScript `Date`. Periods are `CHAR(7)` `'YYYY-MM'`, ordered as strings. Display formatting is `Intl` with `th-TH-u-ca-gregory-nu-latn` — the calendar override is mandatory, since plain `th-TH` renders Buddhist Era, which D-03 forbids. No UTC is ever shown to a user, and no date arithmetic happens in the browser.

### 6.7 Testing approach

**Unit (`node:test`, no database), the highest-value set:**

- `thaiBaht.js` — D-27's four named cases: `0`, `1,790.00`, `1,790.50`, `1,000,000.00`.
- previous-reading resolver — baseline path, normal path, a skipped month, a month entered late, and the upsert-self-exclusion.
- meter-replacement units formula and its two validations (D-13).
- `billStatus` — the SQL expression and the JS helper agree on the same fixtures (D-21).
- due-date rule — `MAX(due day, approval + 3 days)` including the short-month clamp (D-20).
- rate resolution against a fixture history, including a rate effective mid-period (D-17).
- rounding: `ROUND(quantity × unit_price, 2)` and total-equals-sum-of-items (D-16).

**Integration (`supertest` + a disposable MySQL schema), the races that lose money:**

- Confirm Cash Payment twice concurrently → one payment, one receipt, the second gets `409` `บิลนี้ถูกชำระไปแล้ว`.
- Void then re-pay → succeeds, new receipt number, old receipt still holds its number (D-25, D-26).
- Generation run twice → `สร้างใหม่ 0`, Drafts recalculated, approved bills untouched (D-18).
- Approve twice → the second is a no-op, not a second batch of LINE messages.
- Daily job twice in one day → second call no-op; manual trigger after it still sends nothing twice (D-32).
- Permission matrix — one test per staff-forbidden route asserting `403` **and** asserting no amount appears in any staff response body (D-36).
- Reverting a bill that has a later bill → refused server-side (D-22).

**Rehearsal test.** One script that runs `seed.sql`, then walks the PRD §28 scenario end to end — room 205, 10 units, 70 units, 180 / 560 / 1,050 / 1,790 บาท, approve, pay, receipt — asserting the arithmetic, not the calendar (D-44). It is both the regression suite for the demo and the thing you run the morning of the defence.

**CI.** GitHub Actions on push: `npm run lint` then `npm test` against a MySQL 8 service container. Nothing else. No coverage gate — a coverage number the team games is worse than no number.

---

## 7. Risks and mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | LINE webhook disabled after repeated failed deliveries to a cold-started free instance | Linking flow dies silently; no new tenant can ever be bound (D-29) | `200` before any work; 10-minute `/healthz` ping keeps the instance warm; runbook re-verifies the webhook URL after every deploy and before the demo (D-43) |
| R2 | LINE free plan's 500 messages/month exhausted mid-project | Sends stop with no error visible anywhere | Test mode defaults ON (D-34); Settings shows `ส่งข้อความเดือนนี้ {N}/500` in warn colour above 450; the graded run targets at most three real accounts |
| R3 | Free managed MySQL provider changes terms or the instance disappears | Total data loss weeks before the defence | `seed.sql` committed and rebuilds everything in one command; `mysqldump` committed before each milestone and the day before the demo; documented local-MySQL fallback for demo day (D-43, D-44) |
| R4 | Bulk approve of 67 rooms times out in one request | Half-sent batch, unclear state | Two round trips: fast commit, then a drained queue in batches of 20; queued rows survive and the daily job finishes them (D-19, D-32) |
| R5 | `previous_reading` snapshot chain corrupted by editing an old month | Every later bill silently wrong | Revert restricted to a room's most recent bill, enforced server-side with a query, not a disabled button (D-12, D-22) |
| R6 | Two cashiers or one double click produce two payments or a duplicate receipt number | Money and receipt integrity | Conditional `UPDATE`, `UNIQUE(active_bill_id)`, `UNIQUE(payment_id)`, counter allocated inside the transaction (D-26) |
| R7 | ENG-3 shipped as D-30 literally specifies | Duplicate LINE messages with no guard at all | Generated `COALESCE` columns in the unique key; one integration test sends the same bill twice in a day and asserts one row, one send |
| R8 | Buddhist-Era dates leak into UI, LINE or the receipt | A visible, embarrassing correctness bug | `-u-ca-gregory` in the one date helper; one unit test asserts `2026`, and the tester's checklist covers the receipt and one LINE message |
| R9 | Receipt does not fit one A5 page on the office printer | Demo-day failure with no code fix available | Fixed A5 route with a print stylesheet; QA prints it on real paper in week 9, not week 15 (D-28) |
| R10 | Seed dates drift so the demo shows Overdue or a wrong due date | The scripted demo contradicts the slides | `seed.sql` computes every date from `CURDATE()`; documents use PRD §28's calendar, the live run reproduces only the arithmetic (D-44) |
| R11 | Team capacity: 3–4 students, one semester, no QA | Half-finished features across the board | The cut list below is agreed **now**, in writing, before anyone is tired |
| R12 | Scope creep back into PRD §24 territory (a QR field, a slip upload, "just a small mobile view") | Fails the scope contract | D-05's list is quoted verbatim in the Limitations section of every document; a PR touching those areas is closed, not reviewed |

### What to cut first, in order

The demo path is **Login → จดมิเตอร์ → generate → Approve & Send → LINE → Confirm Cash Payment → Receipt → LINE**. Nothing on that path is ever cut. Everything else is negotiable in this order:

1. **Reports 3 and 4** (ประวัติรายห้อง 12 เดือน, ห้องที่ใช้สูงสุด) — keep reports 1 and 2; the arrears list is what the office actually opens (D-42).
2. **CSV export** — the screens stay, the shared export helper goes.
3. **Dashboard charts beyond two** — keep 12-month water and 12-month electricity; drop revenue and the Paid/Unpaid donut. The KPI tiles stay; they are cheap and they are what §16 shows.
4. **Announcements** (D-35) — the second-largest LINE surface, but no other feature depends on it and PRD §15's ประกาศ can be demonstrated by a screenshot.
5. **Meter replacement** (D-13) — keep the hard block on `current < previous`; drop the replacement branch and handle it as a data correction by Admin. Saves a form, two validations and a test.
6. **Soft usage flags** (ใช้สูงผิดปกติ, ไม่มีการใช้งาน) — nice review aid, zero effect on money.
7. **Bulk approve** (D-19) — Bill Detail's single-bill approve alone still demonstrates the flow; 67 rooms one at a time is tedious but correct. Cut the drain endpoint only if the daily job survives, since it is the delivery safety net.
8. **The manual job trigger button** — the external cron is the real path.
9. **The paper ใบแจ้งค่าใช้จ่าย** (D-28) — only if the receipt route is finished and tested first; it is the same layout with fewer fields, so it is nearly free.

**Never cut, whatever happens:** the four unique constraints and the generated columns (§6.2 layer 3); the audit rows on approve, payment and void; LINE test mode; the derived Overdue helper; `seed.sql`. These cost days to retrofit and each one is a class of bug that is invisible until it has already produced a wrong number.

---

## 8. Assumptions recorded by this proposal

1. **JavaScript, not TypeScript.** Runtime validation at the boundary (`zod`) protects the data a human types; a compiler does not. No build step means Render runs `npm start` on the repository as written and a student can read the deployed file. If the team is already fluent in TypeScript by week 3 and the money modules are stable, adding `tsc --noEmit --checkJs` over `lib/` and `services/` is a one-afternoon upgrade — that is the trigger, and nothing else is.
2. **cron-job.org is the scheduler**, with Render Cron Jobs as the paid fallback D-32 allows. If the free scheduler proves unreliable, the second fallback is a second free Render service running a 30-line ping loop — never `node-cron` inside the app process.
3. **`GET_LOCK` is available** on the chosen managed MySQL. It is standard server-side MySQL and requires no privileges beyond the app user; if a provider blocks it, the fallback is an advisory row in `counters` updated with `SELECT … FOR UPDATE`.
4. **`X-Line-Retry-Key` is supported by the pinned SDK major.** If the pinned version's signature differs, the header can be set through the SDK's HTTP config; if it cannot, ENG-4 is dropped and layers 1–3 and 5 still stand.
5. **One process is enough.** All acceptance targets in D-45 are single-instance numbers, and none of the guards above assume a single process anyway — every one of them lives in the database, so scaling to two instances would not break correctness.
6. **The A5 print output is verified on a real printer by week 9.** Browser print CSS is the one part of this stack that cannot be unit tested.
7. **PRD §12's grant of Confirm Cash Payment to เจ้าหน้าที่ is a drafting error**, overridden by §4 and D-36. This is the single place the decision log overrides literal PRD text, and every document must flag it.
8. **PRD §16's 18,500 and 62,500, and §19's 35 ตร.ม. row, are illustrative** and are never used as expected values in a test or a seed (D-44).
