# Juristic Platform — Architecture Proposal (Lean)

**Owner:** Principal Software Engineer · **Status:** Proposed · **Version:** 1.0
**Grounding:** PRD §1–§30 and the PM decision log D-01…D-47. Every non-obvious choice below cites the decision that forces it. Where this document adds an engineering mechanism the decision log did not specify, it is marked **[eng]** and listed in §8 Assumptions.

## 0. The shape of the thing

One Node process, one MySQL database, server-rendered Thai HTML, and a LINE Messaging API client. No SPA, no API gateway, no build step, no container orchestration, no message broker, no Redis, no PDF service, no ORM.

The architecture is dictated more than it is chosen. Three constraints in the decision log remove most of the design space before any preference is expressed:

- **D-43** — the LINE webhook needs one stable HTTPS URL for the life of the project, so the app is a long-lived process on Render, not serverless. It also names the runtime: a single Node.js + Express process serving EJS pages plus Chart.js, with no separate frontend build.
- **D-32 / D-43** — free-tier hosting sleeps and restarts, so no scheduler and no session state may live in process memory. Scheduling is an external cron hitting one authenticated endpoint; sessions live in MySQL.
- **D-26 / D-16 / D-21 / D-17** — the correctness guarantees are written as MySQL constructs: a stored generated column, an atomic `LAST_INSERT_ID` counter, a conditional `UPDATE`, `DECIMAL` money, a `CASE` expression for the derived status. The data layer therefore has to let students write plain SQL, not fight an abstraction to emit it.

What remains is a 2004-shaped web application, which is exactly right for 3–4 students in one semester: one language, one deployable, one place to look when something breaks, and a demo (D-44) that can be rebuilt from `seed.sql` in minutes.

**Dependency budget: 10 runtime packages, 4 dev packages, zero build step.** Every addition beyond that list needs a reason written into this document.

---

## 1. Tech stack

Versions are the floor pinned at kickoff; `package-lock.json` is committed and `npm ci` is what actually reproduces a build (see §8).

| Layer | Choice | Version | Why (one line) |
|---|---|---|---|
| Runtime | Node.js LTS | 24.x | One language for pages, business logic and the LINE client; `--env-file`, `fetch`, `node:test` and `Intl` are all built in, which deletes four dependencies. |
| HTTP framework | Express | 5.1.x | Named in PRD §23 and D-43; v5 forwards async handler rejections to the error middleware, so no `try/catch` wrapper is needed on 40 routes. |
| Views | EJS | 3.1.10 | D-43 fixes server-rendered pages; EJS is HTML with `<%= %>`, so the Thai copy in D-02/D-31 is typed where it is read and nothing has to be learned. |
| Client JS | None (plain ES modules from `/public`, no bundler) | — | D-43 forbids a separate frontend build; the only interactive surfaces are the per-room reading save (D-15), the send-drain loop (D-19) and the change calculator (D-24). |
| Charts | Chart.js from CDN | 4.5.x | PRD §23 and D-41's four charts; a `<script>` tag needs no toolchain and the docs' CDN allowlist already carries it. |
| Database | MySQL | 8.4 LTS | PRD §23; D-26 is written in MySQL 8 dialect (stored generated column, `ON DUPLICATE KEY UPDATE … LAST_INSERT_ID`). |
| Driver / query layer | `mysql2/promise` pool, prepared statements, **no ORM** | 3.15.x | See §1.1 — the four hardest guarantees in the log are SQL, and the students already know SQL from coursework. |
| Schema management | Committed `db/schema.sql` + `db/seed.sql`, rebuilt from empty | — | D-43 already requires a committed seed that recreates the demo in one command; a migration framework buys nothing when there is no production data to preserve. |
| Auth | `express-session` + `express-mysql-session` | 1.18.x / 3.0.x | D-37 verbatim: sessions in MySQL survive the free-tier restarts that would log everyone out mid-demo; no JWT, no token storage. |
| Password hashing | `bcryptjs` | 3.0.x | D-37 specifies bcrypt cost 10; the pure-JS build gives the identical algorithm with no native toolchain on a free tier. **[eng]** |
| Validation | `zod` | 4.x | One schema per request body produces both the 422 payload and the Thai field message of D-40 from a single definition. |
| LINE SDK | `@line/bot-sdk` | 10.x | Signature validation and the specific 400 that D-30 keys auto-unbinding on are the two places a hand-rolled client fails silently; push, multicast (D-34) and `retryKey` come with it. |
| Security headers | `helmet` | 8.x | Three lines, with CSP allowing only the Chart.js CDN and Google Fonts. |
| Rate limiting | `express-rate-limit` | 8.x | D-37's 10 failed logins per IP per 15 minutes, with `app.set('trust proxy', 1)` behind Render's TLS proxy. |
| CSRF | ~20-line double-submit helper in `middleware/csrf.js` | — | D-37 requires a token on every POST; `csurf` is deprecated and a session-stored random token compared against a hidden input is smaller than the dependency. **[eng]** |
| Scheduler | External cron (cron-job.org free, or a Render Cron Job) hitting `POST /internal/jobs/daily` | — | D-32 verbatim: no `node-cron`, because an in-process timer never fires on a sleeping instance. A second 10-minute schedule pings `GET /healthz` (D-43). |
| Receipt / bill printing | Browser `window.print()` on a dedicated A5 route, print stylesheet only | — | D-28 verbatim: no PDF library, no server-side rendering, no Thai font embedding problem. |
| CSV export | ~15-line shared helper, UTF-8 with BOM | — | D-42 needs four exports of already-shaped rows; a CSV library would be larger than the helper. |
| Thai baht in words | Own `lib/thaiBaht.js` + unit test | — | D-27 names it a deliverable with a required test over 0 / 1,790.00 / 1,790.50 / 1,000,000.00. |
| Dates & money formatting | `Intl.DateTimeFormat('th-TH-u-ca-gregory')` and `Intl.NumberFormat('th-TH')` | stdlib | D-03 needs Gregorian Thai months and `1,790.00`; the `-u-ca-gregory` keyword is exactly the "never Buddhist Era" rule, so no date library is installed. |
| Hosting | Render free web service | — | D-43: one fixed HTTPS URL for the webhook, a real long-lived process, free. |
| Database hosting | Aiven (or Clever Cloud) free managed MySQL 8 | — | D-43; connection string in env vars, `mysqldump` committed before every milestone. |
| Lint / format | ESLint 9 flat config + Prettier | 9.x / 3.x | Two config files, no plugins; the point is to stop style arguments in review, not to enforce a methodology. |
| Test | `node:test` + `node:assert/strict`, HTTP driven by built-in `fetch` | stdlib | Zero test dependencies and zero config; see §6.6. |

### 1.1 Why no ORM (the one deviation worth defending)

PRD §23 leaves the data layer open. Prisma or Sequelize would each add a schema language, a generate/migrate step, and a translation layer between what the decision log specifies and what actually reaches the database. The log specifies, at the SQL level:

- `payments.active_bill_id BIGINT UNSIGNED AS (IF(voided_at IS NULL, bill_id, NULL)) STORED` with `UNIQUE` (D-26) — a stored generated column, explicitly *not* to be "simplified" into anything else.
- Receipt numbering by `INSERT … ON DUPLICATE KEY UPDATE seq = LAST_INSERT_ID(seq+1)` inside the payment transaction (D-26).
- The display-status `CASE` expression, which must appear in list queries, not just in JS (D-21).
- Greatest-`effective_from`-not-after-period rate lookup (D-17), greatest-earlier-period reading lookup (D-14), and four aggregate reports with ageing buckets (D-42).

Every one of those is one clear SQL statement and an awkward ORM escape hatch. `mysql2` with prepared statements plus a ~40-line `db/` module (`q`, `one`, `withTx`) is less code than the ORM's configuration, and injection safety comes from placeholders, which is a rule a reviewer can check by grepping for string concatenation.

### 1.2 Why not React / Next.js

PRD §23 offers React/Next.js as a candidate; D-43 already excludes it — Vercel's serverless model cannot give the webhook a stable long-lived endpoint, and a separate frontend build doubles the toolchain for a team that has to ship 12 screens. The two screens that need interactivity get about 150 lines of plain JS. JavaScript is used rather than TypeScript for the same reason: no build step, and the type safety a capstone actually needs comes from `zod` at the trust boundary and `DECIMAL` in the schema. **[eng]**

---

## 2. High-level architecture

<div class="diagram">
<pre class="mermaid">
flowchart LR
  subgraph Clients
    A["Admin browser, desktop 1280px"]
    B["Staff browser, phone 360px"]
    T["Tenant LINE app"]
  end
  CR["External cron, free tier"]
  LP["LINE Platform"]

  subgraph Render["Render free web service, one Node 24 process"]
    EX["Express 5 app"]
    RT["Routes, EJS pages and small JSON endpoints"]
    SV["Services: billing, approval, payments, line, reports"]
    WH["POST /line/webhook, ACK 200 first"]
    JB["POST /internal/jobs/daily, X-Job-Token"]
    HZ["GET /healthz"]
  end

  DB[("MySQL 8.4 managed, app data and session store")]

  A --> EX
  B --> EX
  EX --> RT --> SV --> DB
  T --> LP
  LP --> WH --> SV
  SV -->|"push and multicast"| LP
  LP --> T
  CR -->|"09:00 Asia/Bangkok daily"| JB --> SV
  CR -->|"every 10 minutes, keep awake"| HZ
</pre>
<div class="caption">Six moving parts, two of them free external schedules. Everything inside the box is one process and one deployment.</div>
</div>

### 2.1 Request path

Every HTML request walks the same short chain, in this order:

1. `helmet` — security headers, CSP limited to the Chart.js CDN and Google Fonts.
2. `express.static` for `/public` — served before the session so assets never touch MySQL.
3. `express-session` with the MySQL store — `httpOnly`, `SameSite=Lax`, `Secure` in production, rolling 8-hour expiry (D-37).
4. `csrf` — issues a token into the session, verifies it on every POST (D-37).
5. `requireLogin` then `requireRole('admin' | 'staff')` — the single enforcement point for the D-36 matrix. Money fields are *removed from the response*, not merely hidden in the template.
6. Route handler — parses with `zod`, calls exactly one service function, renders EJS or returns JSON.
7. `errors.js` — the last middleware, turning every thrown error into the one response shape in §6.3.

Three routes bypass steps 3–5 and are exempt by design (D-37): `/line/webhook` (verified by `X-Line-Signature`), `/internal/jobs/daily` (verified by `X-Job-Token`), and `/healthz` (public). The rate limiter never applies to those three.

Only five endpoints return JSON rather than a page: per-room reading save (D-15), the approve call and the send-drain call (D-19), the dashboard chart series (D-41), and the print-count increment (D-27). Everything else is a normal form POST followed by a redirect, which is what makes the failed-save behaviour in D-40 a re-render with the typed values still in place.

### 2.2 Where the scheduler runs

Outside the application entirely (D-32). A free external scheduler holds two schedules:

- **09:00 Asia/Bangkok, daily** → `POST /internal/jobs/daily` with the `X-Job-Token` shared secret. The handler inserts into `job_runs` with `UNIQUE(job_name, run_date)` first; a duplicate key means the day already ran and it returns immediately. It then sends `PRE_DUE` at due−2 and `OVERDUE` at due+1, +8, +15 (D-33), drains any `queued` notifications left by a bulk approval (D-19), retries `failed` rows below `attempt_count = 3` (D-30), and changes no bill status ever (D-21).
- **Every 10 minutes** → `GET /healthz`, which does one `SELECT 1`. This is a *separate* schedule because a once-a-day request keeps a Render free instance awake for one minute, not one day (D-43).

Settings also carries the Admin button `รันงานแจ้งเตือนตอนนี้`, which calls the identical code path with `job_name='daily_manual'` and does **not** consult `job_runs`, so a 14:00 demo still sends after the 09:00 cron ran (D-32). Safety there comes from the notification dedupe key alone, which is sufficient.

### 2.3 Where the LINE webhook lands

`POST /line/webhook`, mounted with `express.raw({ type: '*/*' })` ahead of the JSON body parser so the exact bytes are available for `validateSignature`. The handler:

1. Verifies `X-Line-Signature` against the channel secret; a mismatch is a 401 and nothing else happens.
2. **Responds 200 immediately**, then processes events after the response (D-29, D-43). A cold-started free instance therefore still ACKs inside LINE's timeout, and the endpoint is never auto-disabled — which matters more than it looks, because the webhook is the only way a `userId` ever reaches the system (D-29).
3. Handles exactly three event kinds: `follow` (store `userId` + display name in `line_followers`), `message` carrying a 6-character link code (bind to the tenant, expire the code, reply `LINK_OK`), and everything else (one fixed auto-reply pointing at the office — the OA is not a chatbot).

---

## 3. Domain model

### 3.1 Entities

<div class="diagram">
<pre class="mermaid">
erDiagram
  users ||--o{ meter_readings : records
  users ||--o{ payments : receives
  users ||--o{ audit_log : acts
  rooms ||--o{ tenants : houses
  rooms ||--o{ meter_readings : has
  rooms ||--o{ bills : billed
  tenants ||--o{ bills : owes
  tenants ||--o{ link_codes : invited
  tenants ||--o{ notifications : receives
  bills ||--|{ bill_items : contains
  bills ||--o{ payments : settled_by
  bills ||--o{ notifications : notifies
  payments ||--|| receipts : issues
  announcements ||--o{ notifications : broadcasts
  rates ||--o{ bill_items : priced_by
</pre>
<div class="caption">Fifteen tables plus <code>counters</code>, <code>job_runs</code>, <code>line_followers</code>, <code>settings</code> and the session table. No building table (D-04), no periods table (D-11), no meters table (D-13).</div>
</div>

| Table | Key fields | Notes |
|---|---|---|
| `users` | `username` UNIQUE, `display_name`, `password_hash`, `role ENUM('admin','staff')`, `status` | `display_name` is what prints as ผู้รับเงิน on the receipt (D-46, D-27). Never deleted, only Inactive. |
| `settings` | single row `id=1`: `apartment_name`, `address`, `tax_id` NULL, `phone`, `office_hours`, `due_day TINYINT` (1–28, default 5), `line_test_mode` (default 1), `line_test_user_id` | One property, one building (D-04). `tax_id` optional — the letterhead omits the line when empty (D-27). Test mode defaults ON everywhere (D-34). |
| `rooms` | `room_code VARCHAR(10)` UNIQUE, `floor TINYINT`, `room_type` NULL, `area_sqm DECIMAL(6,2)`, `baseline_water`, `baseline_electric`, `baseline_date`, `status ENUM('Occupied','Vacant')`, `is_active` | Floor is stored, never parsed from the code (D-47). Baselines are the opening readings and live here, not in `meter_readings` (D-06). Deactivate, never delete, once a bill references it. |
| `tenants` | `room_id`, `full_name`, `phone`, `move_in_date`, `move_out_date` NULL, `status ENUM('Active','Inactive')`, `line_user_id` NULL, `line_display_name` NULL, `line_linked_at` NULL | At most one Active tenant per room (D-10). The LINE binding is three columns rather than a `LineAccounts` table because D-29 keys it `UNIQUE(tenant_id)`, which a column satisfies by construction — one table and one join deleted. **[eng]** |
| `link_codes` | `code CHAR(6)` PK, `tenant_id`, `expires_at`, `used_at` NULL | Alphabet excludes O/0/I/1; 7 days, single use (D-29). |
| `line_followers` | `line_user_id` PK, `display_name`, `followed_at` | Written by the `follow` event, read when the code arrives (D-29). |
| `meter_readings` | `room_id`, `period CHAR(7)`, `utility_type ENUM('water','electric')`, `previous_reading`, `current_reading`, `units`, `previous_period VARCHAR(8)`, `meter_replaced`, `old_final` NULL, `new_start` NULL, `replace_reason` NULL, `recorded_by`, `recorded_at` | `UNIQUE(room_id, period, utility_type)` makes a double submit an UPSERT (D-12). `CHECK (units >= 0)` (D-13). `previous_period` holds `'baseline'` or `YYYY-MM` (D-06, D-14). |
| `rates` | `utility_type ENUM('water','electric','common')`, `unit_price DECIMAL(8,2)`, `effective_from DATE`, `created_by`, `created_at`, `UNIQUE(utility_type, effective_from)` | Insert-only history; a rate is never UPDATEd (D-17). |
| `bills` | `room_id`, `tenant_id`, `period CHAR(7)`, `room_code_snapshot`, `room_area_snapshot`, `tenant_name_snapshot`, `total DECIMAL(10,2)`, `status ENUM('Draft','Unpaid','Paid')`, `due_date` NULL, `approved_at`, `approved_by`, `UNIQUE(room_id, period)` | Three snapshot columns are what make a reprint reproducible without versioning tables (D-09). `Overdue` is never stored (D-21). |
| `bill_items` | `bill_id`, `item_type ENUM('water','electric','common')`, `quantity DECIMAL(10,2)`, `unit_price DECIMAL(8,2)`, `amount DECIMAL(10,2)`, `previous_reading` NULL, `current_reading` NULL, `previous_period` NULL, `UNIQUE(bill_id, item_type)` | Always exactly three rows per bill, even at 0 units and 0.00 (D-18, D-41). |
| `payments` | `bill_id`, `amount`, `paid_at`, `received_by_user_id`, `method='cash'`, `voided_at` NULL, `voided_by` NULL, `void_reason` NULL, `active_bill_id` generated STORED UNIQUE | `active_bill_id = IF(voided_at IS NULL, bill_id, NULL)` — one live payment per bill, unlimited voided ones (D-26). Never deleted (D-25). |
| `receipts` | `payment_id` UNIQUE, `receipt_no VARCHAR(20)` UNIQUE, `issued_at`, `print_count INT DEFAULT 0`, `voided_at` NULL | Keeps its number when voided; that, not gaplessness, is what voiding buys (D-25, D-27). |
| `counters` | `name` PK, `seq BIGINT` | One row, `name='receipt'` (D-26). |
| `announcements` | `title` (≤60), `body` (≤400), `audience ENUM('all','floors')`, `floors` (CSV of floor numbers), `sent_at`, `sent_by` | Immutable once sent (D-35). |
| `notifications` | `type`, `bill_id` NULL, `announcement_id` NULL, `tenant_id`, `recipient_user_id`, `status ENUM('queued','sent','failed','skipped_no_line')`, `attempt_count`, `last_error`, `http_status`, `last_attempt_at`, `send_date`, `dedupe_key` generated STORED UNIQUE | One row per **recipient**, never per API call (D-30). See §3.7 for why the unique key is a generated column. |
| `audit_log` | `entity_type`, `entity_id`, `bill_id` NULL, `action`, `actor_user_id`, `before_json`, `after_json`, `reason`, `created_at` | Twelve audited actions, one helper, written inside the same transaction (D-38). |
| `job_runs` | `job_name`, `run_date`, `started_at`, `finished_at`, `result_json`, `UNIQUE(job_name, run_date)` | Guards the scheduled path only (D-32). |

### 3.2 Bill state machine

Three stored statuses, four displayed. `Overdue` is derived by one shared SQL expression and one shared JS function (D-21):

```sql
CASE WHEN b.status = 'Unpaid' AND b.due_date < CURDATE()
     THEN 'Overdue' ELSE b.status END AS display_status
```

<div class="diagram">
<pre class="mermaid">
stateDiagram-v2
  [*] --> Draft: generation run, D-18
  Draft --> Unpaid: Approve and Send, freezes the bill, D-19 D-22
  Unpaid --> Paid: Confirm Cash Payment, D-24
  Unpaid --> Draft: revert with reason, newest bill only, D-22
  Paid --> Unpaid: void payment, cash returned first, D-25
  Paid --> [*]
  note right of Unpaid
    Overdue is a display value only.
    due_date less than today renders Overdue.
    Nothing writes it, no job produces it. D-21
  end note
</pre>
<div class="caption">Two reverse edges, both Admin-only, both requiring a Thai reason of at least 10 characters and both audited.</div>
</div>

Every write path that mutates a bill or its readings goes through one guard: readings are editable exactly while the room's bill for that period is `Draft` or absent (D-12); the revert button exists only on a room's most recent bill, because a later bill's `previous_reading` is a snapshot of the value being edited (D-22).

### 3.3 Rate versioning and resolution

Rates are effective-dated and insert-only; a Settings save never UPDATEs a row (D-17). Resolution is keyed to the **period**, not to the moment generation was clicked, so a room read ten days late still carries the same rate as the rest of its month:

```sql
SELECT unit_price
  FROM rates
 WHERE utility_type = ?
   AND effective_from <= CONCAT(?, '-01')   -- first day of the bill's period month
 ORDER BY effective_from DESC
 LIMIT 1;
```

The resolved `unit_price` is copied onto the `bill_items` row together with the quantity. Every screen, print view and LINE message renders from that snapshot; approved bills are immune to later rate changes. If Draft bills exist for a period when a back-dated rate is saved, Settings shows the D-17 banner with a `คำนวณบิลฉบับร่างใหม่` button that recalculates Draft bills only.

### 3.4 Previous-reading resolution

One code path, no special cases (D-14, and D-06 is what makes that true):

```sql
SELECT current_reading, period
  FROM meter_readings
 WHERE room_id = ? AND utility_type = ? AND period < ?   -- strictly earlier
 ORDER BY period DESC
 LIMIT 1;
```

If a row comes back, that is `previous_reading` and `previous_period`. If nothing comes back, the room's `baseline_water` / `baseline_electric` is used with `previous_period = 'baseline'`. Ordering is by `period`, never by `recorded_at`, so a late catch-up entry produces the same arithmetic as a punctual one; ties are impossible under the unique key; the row being written is excluded by `period < ?`, so an UPSERT can never take itself as its own previous. Readings taken while a room was vacant count, gaps never block a run, and when the resolved `previous_period` is not the immediately preceding month the bill and its LINE message both say so.

### 3.5 Receipt number generation

Inside the payment transaction, after the conditional status update succeeds (D-26, D-27):

```sql
INSERT INTO counters (name, seq) VALUES ('receipt', 1)
  ON DUPLICATE KEY UPDATE seq = LAST_INSERT_ID(seq + 1);
SELECT LAST_INSERT_ID();
```

`receipt_no = 'REC-' + <payment month YYYYMM> + '-' + seq.padStart(6, '0')` → `REC-202609-000852`. One continuous counter that never resets. The sequence is unique and monotonic but **not gapless** — a rolled-back transaction consumes a number, and the seed starts at an offset to reproduce the PRD's own 852 (D-44). No document or test may claim gaplessness.

### 3.6 Audit trail

One `audit_log` table and one helper, `writeAudit(conn, { entityType, entityId, billId, action, actorUserId, before, after, reason })`, called with the *same connection* as the change so it commits or rolls back with it (D-38). `bill_id` is set on every bill-attributable row, which makes Bill Detail's Admin timeline exactly `SELECT * FROM audit_log WHERE bill_id = ? ORDER BY created_at` with no cross-entity join. Twelve audited actions; logins, page views and report exports are deliberately not audited.

### 3.7 Notification log and its dedupe key **[eng]**

D-30 specifies `UNIQUE(type, bill_id, announcement_id, tenant_id, send_date)`. That index cannot enforce the rule in MySQL: InnoDB treats NULLs as distinct, and a bill notification always has `announcement_id IS NULL`, so every duplicate would be accepted. The rule is implemented with the same mechanism D-26 already uses for payments — a stored generated column carrying the identical semantics:

```sql
dedupe_key VARCHAR(80) AS (CONCAT_WS(':', type, IFNULL(bill_id,0),
             IFNULL(announcement_id,0), tenant_id, send_date)) STORED,
UNIQUE KEY uq_notification (dedupe_key)
```

This is a mechanism correction, not a policy change: one message type per bill per tenant per day, exactly as decided. Retries UPSERT that row and increment `attempt_count`; automatic retries stop at 3, the Admin's manual resend is never capped.

---

## 4. Key flows

### 4.1 Monthly billing — readings to LINE

<div class="diagram">
<pre class="mermaid">
sequenceDiagram
  autonumber
  participant S as Staff phone
  participant A as Admin desktop
  participant App as Express app
  participant DB as MySQL
  participant L as LINE Platform

  S->>App: POST reading for one room, water and electric
  App->>DB: resolve previous by greatest earlier period, else baseline
  App->>DB: UPSERT meter_readings, units snapshot
  App->>DB: recalculate this room Draft bill if one exists
  App-->>S: saved, counter now 42 of 67
  S->>App: press send to juristic for review
  App->>DB: generate for period, skip vacant and skip approved
  App-->>S: created a, updated b, skipped c, unread d
  A->>App: open Monthly Billing, select Draft bills
  A->>App: POST approve, N bills
  App->>DB: one transaction, Draft to Unpaid, freeze, due date MAX rule
  App->>DB: insert one queued notification per bill
  App-->>A: committed in under five seconds, result screen
  loop until queue empty, at most 20 per call
    A->>App: POST send drain
    App->>L: push BILL to each linked tenant
    L-->>App: 200 or error
    App->>DB: mark sent, failed or skipped_no_line
    App-->>A: running counts
  end
</pre>
<div class="caption">Approval and delivery are two round trips (D-19). The commit never waits on LINE, and a dropped connection loses nothing because the queued rows survive and the 09:00 job would finish them.</div>
</div>

Generation is idempotent by `UNIQUE(room_id, period)`: a run creates Draft bills for billable rooms that have both readings and no bill, recalculates existing Draft bills in place, and never touches `Unpaid` or `Paid` (D-18). A room is billable only when `rooms.status='Occupied'` and it has exactly one Active tenant (D-07). Rooms missing readings are skipped and surfaced in the D-23 banner; approval is never blocked.

Due date is computed once at approval and frozen: `due_date = MAX(due_day of the period month, approval_date + 3 days)`, clamped to the month's last day (D-20).

### 4.2 Cash payment — confirm to receipt to LINE

<div class="diagram">
<pre class="mermaid">
sequenceDiagram
  autonumber
  participant A as Admin at counter
  participant App as Express app
  participant DB as MySQL
  participant L as LINE Platform

  A->>App: search room 205, open the Unpaid bill
  App-->>A: total 1,790.00 read only, change calculator on screen only
  A->>App: POST confirm cash payment, CSRF token
  App->>DB: BEGIN
  App->>DB: UPDATE bills SET Paid WHERE id and status Unpaid
  Note over App,DB: zero rows affected means already paid, 409 in Thai
  App->>DB: INSERT payment, unique active_bill_id blocks a double click
  App->>DB: allocate receipt number from counters
  App->>DB: INSERT receipt, INSERT audit row
  App->>DB: COMMIT
  App-->>A: receipt page, print button ready
  App->>L: push PAID confirmation, outside the transaction
  App->>DB: notification row sent or failed
</pre>
<div class="caption">Money is committed before any message is attempted (D-30). A LINE outage cannot roll back a payment and cannot stop a receipt printing.</div>
</div>

Three independent guards make a double-clicked confirm a non-event (D-26): the conditional `UPDATE`, the `UNIQUE(active_bill_id)` generated column, and `UNIQUE(payment_id)` on receipts. The disabled button and spinner are a courtesy, never the guarantee. Voiding (D-25) marks the payment and the receipt voided without deleting either, returns the bill to `Unpaid`, writes an audit row with the required reason, and excludes the bill from automatic `PRE_DUE` / `OVERDUE` sends.

### 4.3 LINE account linking

<div class="diagram">
<pre class="mermaid">
sequenceDiagram
  autonumber
  participant A as Admin
  participant App as Express app
  participant DB as MySQL
  participant T as Tenant
  participant L as LINE Platform

  A->>App: create link code for tenant of room 205
  App->>DB: INSERT link_codes, 6 chars, valid 7 days, single use
  App-->>A: printable slip with the code and the OA QR
  A->>T: hand over the slip at the office
  T->>L: add the Official Account as a friend
  L->>App: webhook follow event
  App-->>L: 200 first
  App->>DB: store line_followers userId and display name
  T->>L: send the 6 character code as a chat message
  L->>App: webhook message event
  App-->>L: 200 first
  App->>DB: match code, bind userId to the tenant, expire the code
  App->>L: reply LINK_OK naming the room
  L->>T: binding confirmed
</pre>
<div class="caption">No LIFF, no app, no staff typing a userId — a tenant cannot read their own userId anywhere in LINE, so this is the only self-service path (D-29).</div>
</div>

Uniqueness is on the tenant, not the LINE account: one phone may be bound to two rooms and every template names the room, so a message to a doubly-bound `userId` is two `notifications` rows (D-29). A wrong or expired code gets `LINK_FAIL`; anything else gets one fixed auto-reply.

### 4.4 Reminder and overdue scheduler

<div class="diagram">
<pre class="mermaid">
sequenceDiagram
  autonumber
  participant C as External cron
  participant App as Express app
  participant DB as MySQL
  participant L as LINE Platform

  C->>App: POST internal jobs daily 09:00, X-Job-Token
  App->>DB: INSERT job_runs, unique job name and run date
  Note over App,DB: duplicate key means today already ran, return early
  App->>DB: select Unpaid bills where due date minus today equals 2
  App->>DB: select Unpaid bills where days overdue in 1, 8, 15
  Note over App,DB: exclude bills whose latest payment was voided, D-25
  App->>DB: drain queued rows left by a bulk approval
  App->>DB: retry failed rows below attempt count 3
  loop each recipient
    App->>L: push PRE_DUE or OVERDUE with a retry key
    App->>DB: UPSERT notification, increment attempt count
  end
  App-->>C: counts sent, skipped and failed
  C->>App: GET healthz every 10 minutes, separate schedule
</pre>
<div class="caption">At most four automatic messages per bill for its entire life (D-33). The job never writes a bill status (D-21).</div>
</div>

---

## 5. Module layout

```
juristic-platform/
├─ server.js                 app wiring, middleware order, graceful shutdown
├─ package.json              10 runtime deps, 4 dev deps, "start": "node server.js"
├─ eslint.config.js
├─ .env.example              DATABASE_URL, SESSION_SECRET, LINE_*, JOB_TOKEN, TZ, SEED_ADMIN_PASSWORD
├─ db/
│  ├─ pool.js                mysql2 pool, TZ +07:00, DECIMAL as string
│  ├─ tx.js                  withTx(fn) — one connection, BEGIN/COMMIT/ROLLBACK
│  ├─ schema.sql             every table, key and CHECK in one file
│  └─ seed.sql               D-44 demo data, all dates relative to CURDATE()
├─ middleware/
│  ├─ auth.js                requireLogin, requireRole — the D-36 matrix, one place
│  ├─ csrf.js                token issue and verify
│  ├─ errors.js              one error shape, Thai 403 page, Thai 500 page (D-40)
│  └─ audit.js               writeAudit(conn, …) (D-38)
├─ routes/
│  ├─ auth.js  dashboard.js  rooms.js  tenants.js  users.js  settings.js
│  ├─ readings.js            list, per-room save, generation trigger (D-15, D-18)
│  ├─ bills.js               list, detail, approve, send-drain, revert (D-19, D-22)
│  ├─ payments.js            confirm, void (D-24, D-25)
│  ├─ receipts.js            A5 view, print-count increment, invoice view (D-27, D-28)
│  ├─ announcements.js       compose, preview, send (D-35)
│  ├─ reports.js             four reports plus CSV (D-42)
│  ├─ line-webhook.js        raw body, signature, ACK 200 first (D-29)
│  └─ jobs.js                daily job endpoint plus healthz (D-32, D-43)
├─ services/
│  ├─ billing.js             previous-reading and rate resolution, generate, recalculate
│  ├─ approval.js            freeze, due date, queue notifications
│  ├─ payments.js            confirm, void, receipt numbering
│  ├─ line.js                client, push and multicast, test-mode redirect (D-34)
│  ├─ templates.js           the seven Thai templates, braced placeholders only (D-31)
│  ├─ notify.js              queue, drain, retry, per-recipient rows (D-30)
│  └─ reports.js             the four report queries
├─ lib/
│  ├─ money.js               DECIMAL arithmetic, ROUND half-up at the item (D-16)
│  ├─ format.js              THB and unit formatting, one helper (D-03)
│  ├─ thaiDate.js            Intl th-TH-u-ca-gregory, period labels (D-03)
│  ├─ thaiBaht.js            amount in words, satang aware (D-27)
│  └─ status.js              billStatus(bill) — the JS half of D-21
├─ views/                    EJS: layout, partials, one file per page, print/receipt.ejs
├─ public/                   css, chart bootstrap, reading-page JS, print.css @page A5
└─ test/                     *.test.js (node:test)
```

Twelve route files map one-to-one onto the twelve PRD pages plus the webhook and the job, which is the property that makes the codebase navigable by a student who has not read it. Services hold every rule that a test can assert without HTTP; routes hold no arithmetic at all.

---

## 6. Cross-cutting concerns

### 6.1 Auth and roles

Sessions in MySQL, bcrypt cost 10, rolling 8 hours, logout deletes the row (D-37). Two roles on `users.role` (D-36). One middleware, `requireRole('admin')`, is the enforcement point; the navigation is generated from the same table so a link can never exist for a page the role cannot open. Staff never receive a bill amount, a rate, a payment or a receipt — those fields are absent from the query, not hidden in the template, which is the only version of the rule that survives someone opening dev tools. Login is rate limited to 10 failures per IP per 15 minutes with `trust proxy` set, because without it one wrong password locks out the whole demo behind Render's shared proxy (D-37).

### 6.2 Validation

One `zod` schema per request body, in the route file next to the handler. Validation is layered, and the layers are deliberate:

- **Form** — `inputmode="numeric"`, `min`, `required`, and the D-13 live check that disables Save when the current reading is below the previous one.
- **API (`zod`)** — types, ranges, Thai mobile format `0XXXXXXXXX`, string lengths (announcement title 60, body 400), reason minimum 10 characters.
- **Business rules (services)** — the ones that need the database: current-below-previous, meter-replacement arithmetic, one-Active-tenant, end-of-tenancy gating (D-08), revert-newest-only (D-22).
- **Database** — `UNIQUE`, `CHECK (units >= 0)`, `DECIMAL`, foreign keys, the two generated columns. This layer is the one that is actually true under concurrency; the three above it exist to give a human a good message.

### 6.3 Error format

One shape from every JSON endpoint, produced by `middleware/errors.js`:

```json
{ "error": { "code": "READING_BELOW_PREVIOUS",
             "message": "เลขมิเตอร์ปัจจุบันน้อยกว่าเดือนก่อน (1,250) กรุณาตรวจสอบ",
             "fields": { "current_reading": "ต้องไม่น้อยกว่า 1,250" } } }
```

| Status | Meaning | Example |
|---|---|---|
| 400 | Malformed request or failed `zod` parse | missing `period` |
| 403 | Role denied — HTML gets the Thai 403 page with a button back to จดมิเตอร์ (D-40) | staff opening a bill URL |
| 404 | Not found | unknown bill id |
| 409 | Lost a concurrency race | `บิลนี้ถูกชำระไปแล้ว` (D-26) |
| 422 | Valid shape, rejected business rule | current reading below previous (D-13) |
| 500 | Unexpected — Thai page, stack to the server log only | — |

HTML form posts never redirect on failure: the page re-renders with the typed values and an inline error above the form (D-40).

### 6.4 Idempotent LINE sends

Four layers, each cheap (D-30, D-32, D-34):

1. `notifications.dedupe_key` UNIQUE — one message type per bill per tenant per day (§3.7).
2. `attempt_count` on the same row — automatic retries stop at 3; the manual resend is uncapped.
3. `X-Line-Retry-Key` on every push, so a retry after a timeout that actually delivered does not double-send at LINE's end.
4. `job_runs` UNIQUE `(job_name, run_date)` — a retrying scheduler cannot run the day twice. The manual demo button deliberately bypasses this layer and relies on layer 1.

Announcements go by multicast in chunks of ≤500 `userId`s, one `notifications` row per recipient regardless, so D-35's per-announcement result and D-34's monthly quota count are the same query. `โหมดทดสอบ LINE` defaults ON in every environment and redirects every outbound message to one whitelisted `userId` while still recording the intended recipient.

### 6.5 Money and time

- Money `DECIMAL(10,2)`, rates `DECIMAL(8,2)`, area `DECIMAL(6,2)`, readings `INT UNSIGNED`. `FLOAT`/`DOUBLE` appear nowhere; the pool returns `DECIMAL` as a string so no JS float ever touches an amount (D-16).
- Rounding happens exactly once, at the item: `amount = ROUND(quantity × unit_price, 2)` half-up, stored rounded. The total is the sum of already-rounded items, so a printed receipt always equals the sum of its printed lines. No second rounding, no satang suppression (D-16).
- All formatting goes through `lib/format.js`; the API sends pre-formatted strings and browser JS never recomputes a total it displays (D-16, D-03).
- `TZ=Asia/Bangkok` on the process, `time_zone='+07:00'` on the connection. Dates that are business facts (`due_date`, `paid_at` date, `baseline_date`) are `DATE`; instants (`created_at`, `last_attempt_at`) are `DATETIME`. The period is `CHAR(7)` `YYYY-MM` and sorts correctly as a string, which is what makes D-14's `ORDER BY period DESC` free.
- Thai rendering via `Intl.DateTimeFormat('th-TH-u-ca-gregory', { timeZone: 'Asia/Bangkok' })`; the `ca-gregory` keyword is the "never Buddhist Era" rule expressed once (D-03).

### 6.6 Testing

Three tiers, no framework, run by `node --test` (D-45 supplies the acceptance numbers):

1. **Pure unit, no database** — the calculators and helpers, which is where the project's actual business logic lives: units and meter replacement (D-13), item rounding and totals (D-16), previous-reading resolution given a fixture list (D-14), rate resolution by period (D-17), the due-date `MAX` rule (D-20), `billStatus()` (D-21), receipt-number formatting (D-27), and `thaiBaht()` over 0 / 1,790.00 / 1,790.50 / 1,000,000.00 (D-27, a named deliverable). The PRD §28 arithmetic — 10 units × 18 = 180, 70 × 8 = 560, 30 × 35 = 1,050, total 1,790 — is one test that must never go red.
2. **Database integration, scratch schema** — the five guarantees that only exist in SQL: double-submit UPSERT on a reading, double-confirm blocked by `UNIQUE(active_bill_id)`, the conditional `UPDATE` returning zero rows, concurrent receipt allocation never producing a duplicate, and the notification dedupe key rejecting a same-day repeat.
3. **One end-to-end smoke script** — against the D-44 seed with LINE test mode ON: read room 205 → generate → approve → send → confirm payment → receipt number issued → both notification rows recorded. This is the demo path, so it is the test that runs before every push.

Beyond that: the tester role's manual plan against the D-36 permission matrix and the D-45 targets. No Playwright, no Jest, no coverage gate — a capstone that spends a week on test infrastructure ships eight screens instead of twelve.

---

## 7. Risks and cuts

### 7.1 Risks

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R1 | LINE Official Account or Messaging API channel not approved in time | Medium | Register in week 1 — it is on the critical path for D-29, which everything tenant-facing depends on. Until it exists, `services/line.js` runs against a stub that writes `notifications` rows and logs the payload; nothing else in the codebase knows the difference. |
| R2 | Free MySQL provider suspends or deletes the instance | Medium | `schema.sql` + `seed.sql` rebuild everything from empty in one command; `mysqldump` committed before every milestone and the day before the demo (D-43). Recovery is measured in minutes. |
| R3 | Cold start makes the webhook time out, LINE auto-disables it, linking dies silently | Medium | 10-minute `/healthz` ping as its own schedule, plus ACK-200-before-work on the webhook (D-43). Runbook line: re-verify the webhook URL in the LINE console after every deploy and before the demo. |
| R4 | The 500-message free quota is exhausted during rehearsals, so demo-day sends vanish | Medium | Test mode defaults ON everywhere and is switched off only for the rehearsed path (D-34); Settings shows `ส่งข้อความเดือนนี้: {N}/500` in warn colour above 450. |
| R5 | Bulk approve of 67 bills times out on a free instance | Medium | Already designed out: commit and delivery are two round trips, the drain sends ≤20 per call, and the 09:00 job finishes whatever is left (D-19). |
| R6 | Students under-estimate the print and Thai-typography work | Medium | A5 print stylesheet built in week 2 against a real printer, not in the last week. The receipt fitting on one A5 page is a QA check, not an assumption (D-28). |
| R7 | Snapshot chain corrupted by editing an old month | Low, severe | Structurally prevented: revert is limited to a room's most recent bill (D-22), readings freeze at approval (D-12), and there is an integration test for both. |
| R8 | Timezone or Buddhist-era slip reaching a tenant's phone | Medium | One formatting module, `TZ` set at the process and the connection, `ca-gregory` forced, and a unit test asserting `3 กันยายน 2026` (D-03). |
| R9 | Demo-day data is wrong because the seed used fixed dates | High if ignored | `seed.sql` computes every date from `CURDATE()`; PRD §28's calendar values are documentation-only and the demo reproduces the arithmetic, not the calendar (D-44). |
| R10 | Team velocity — 12 pages, 30 PRD functions, one semester | High | The cut list below is agreed in advance, so cutting is a decision already made rather than a panic in week 14. |

### 7.2 What to cut first

Cut in this order. Everything above the line can be dropped without touching the graded demo path or a PRD §18 function that has no substitute.

1. **Report 4, ห้องที่ใช้น้ำ/ไฟสูงสุด** — the only report with no month-end job behind it (D-42).
2. **CSV export on all four reports** — the screens remain; the office can read the numbers (D-42).
3. **Floor-scoped announcement audience** — ship `ทุกห้องที่มีผู้เช่า` only; the floor multi-select is a `WHERE` clause that can return later (D-35).
4. **Bulk approve** — keep the single-bill `อนุมัติและส่งบิล` on Bill Detail, which is what the demo uses. Approving 67 bills one at a time is slow, not broken (D-19).
5. **Meter replacement flow** — keep the hard block on current-below-previous; a replaced meter is then an Admin data fix. Loses D-13's second half only.
6. **Void payment** — keep the audit trail and fix mistakes in the database with a documented runbook step. Costs D-25's convenience, not its correctness.
7. **Soft usage flags (ใช้สูงผิดปกติ / ไม่มีการใช้งาน)** — advisory badges only (D-13).
8. **Bill Detail audit timeline UI** — keep the `audit_log` writes, drop the screen (D-38).
9. **Two of the four dashboard charts** — keep water units and revenue (D-41).

**Never cut, in any circumstance** — this is the graded spine of D-44 and the PRD §28 scenario: login and roles; rooms and tenants; meter entry with previous-reading resolution; the three calculations; bill generation and the single approval gate; the BILL LINE message; cash payment; receipt with its number and print view; the PAID LINE message; the Dashboard money tiles; the reading-history report. Also never cut: the four database guarantees in §6.4 and D-26 — they are perhaps 20 lines of SQL in total, and they are the difference between a demo that survives a double-click in front of an examiner and one that does not.

---

## 8. Assumptions recorded

1. **Version pinning.** The versions in §1 are the floor at kickoff (September 2026). `package-lock.json` is committed and `npm ci` is what reproduces a build; a minor bump is fine, a major one is a decision.
2. **JavaScript, not TypeScript.** ESM throughout, JSDoc where a shape is non-obvious. No build step for the server, matching D-43's no-build-step rule for the client. Type safety at the boundaries comes from `zod` and from `DECIMAL`.
3. **`bcryptjs` substitutes for `bcrypt`.** Same algorithm, same cost 10 (D-37), no native compilation on the free tier.
4. **The LINE binding lives on `tenants` as three columns**, not in a `LineAccounts` table. D-29 keys uniqueness to the tenant, which a column enforces by construction; PRD §21's table list is descriptive, not normative.
5. **`notifications` uses a stored generated `dedupe_key`** because D-30's literal composite `UNIQUE` cannot enforce the rule under MySQL's NULL semantics (§3.7). Same policy, working mechanism.
6. **No migration framework in v1.** `schema.sql` is the single source of truth and the database is recreated from empty; a numbered `migrations/` folder starts only if the team needs to preserve data mid-semester.
7. **CSRF is a ~20-line helper**, not a package — `csurf` is deprecated and unmaintained.
8. **`Intl` replaces a date library.** `th-TH-u-ca-gregory` gives Thai month names with Gregorian years, which is exactly D-03; no `dayjs`, no `moment`, no `date-fns`.
9. **Nothing here reintroduces a PRD §24 exclusion.** No rent, no lease contracts, no mobile app, no payment gateway, no card, no online banking, no slip upload, no QR payment, no IoT or automatic meters, no AI/ML. Payment is cash at the counter; the only automation is the reminder job and the LINE messages.
10. **PRD §12's grant of Confirm Cash Payment to เจ้าหน้าที่ is treated as a drafting error**, per D-36 and the decision log's own assumption list; §4 wins and the counter is an Admin login.
