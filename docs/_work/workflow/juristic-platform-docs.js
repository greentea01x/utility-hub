export const meta = {
  name: 'juristic-platform-docs',
  description: 'PM decisions, engineering spec, UI mockups, and test plan as HTML docs for the Juristic platform',
  phases: [
    { title: 'Clarify', detail: 'three lenses surface PRD gaps; PM decides; critic; PM finalizes + writes 01-product-decisions.html' },
    { title: 'Architecture', detail: 'lean + robust + Codex Sol proposals, judged into one ADR' },
    { title: 'Engineering', detail: '6 section writers → assembler → 3 review lenses → fixer → 02-engineering-spec.html' },
    { title: 'Design', detail: 'foundations → 7 screen groups → assembler → 2 review lenses → fixer → 03-ui-design.html' },
    { title: 'Testing', detail: '4 area writers + e2e strategy → assembler → review → fixer → 04-test-plan.html' },
    { title: 'Integrate', detail: 'cross-doc consistency, index.html, completeness critic' },
  ],
}

// ---------------------------------------------------------------- constants
const ROOT = '/Users/peach/Documents/popo/juristic-platform'
const DOCS = ROOT + '/docs'
const PRD = DOCS + '/PRD.md'
const TEMPLATE = DOCS + '/_shared/template.html'
const PARTS = '/private/tmp/claude-501/-Users-peach-Documents-popo-juristic-platform/a8e6b2a2-384a-47c4-9b05-d49ed1b7d937/scratchpad/parts'
const DECISIONS_FILE = PARTS + '/decisions.json'
const ADR_FILE = PARTS + '/adr.md'
const PM_DOC = DOCS + '/01-product-decisions.html'
const ENG_DOC = DOCS + '/02-engineering-spec.html'
const DESIGN_DOC = DOCS + '/03-ui-design.html'
const TEST_DOC = DOCS + '/04-test-plan.html'
const INDEX_DOC = DOCS + '/index.html'
const DATE = (args && args.date) || '2026-09-06'
const USE_CODEX = !!(args && args.codex)
const M = 'opus'

// ---------------------------------------------------------------- schemas
const QUESTIONS = { type: 'object', properties: { questions: { type: 'array', items: { type: 'object', properties: {
  id: { type: 'string' }, topic: { type: 'string' }, question: { type: 'string' }, why_it_matters: { type: 'string' },
  options: { type: 'array', items: { type: 'string' } }, recommended: { type: 'string' } },
  required: ['id', 'topic', 'question', 'why_it_matters', 'options', 'recommended'] } } }, required: ['questions'] }

const DECISIONS = { type: 'object', properties: {
  decisions: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, topic: { type: 'string' }, question: { type: 'string' }, decision: { type: 'string' }, rationale: { type: 'string' },
    affects: { type: 'array', items: { type: 'string' } } }, required: ['id', 'topic', 'question', 'decision', 'rationale', 'affects'] } },
  assumptions: { type: 'array', items: { type: 'string' } },
  notes: { type: 'string' } }, required: ['decisions', 'assumptions'] }

const REVIEW = { type: 'object', properties: {
  issues: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }, location: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } },
    required: ['severity', 'location', 'problem', 'fix'] } },
  verdict: { type: 'string' } }, required: ['issues'] }

const SECTION = { type: 'object', properties: { file: { type: 'string' }, summary: { type: 'string' }, identifiers: { type: 'array', items: { type: 'string' } } }, required: ['file', 'summary'] }

// ---------------------------------------------------------------- shared prompt text
const DEMO = 'PRD §28 demo scenario: room 205, 30 sqm; water 1,250→1,260 = 10 units × 18 THB = 180; electricity 5,280→5,350 = 70 units × 8 THB = 560; common area 30 × 35 = 1,050; total 1,790 THB; due 5 Sep 2026; paid 3 Sep 2026; receipt REC-202609-000852.'

function common(role, extra) {
  return 'You are the ' + role + ' on a four-role documentation team for the "Juristic Platform" (working name in the PRD: UtilityHub): a web application for managing apartment water, electricity and common-area fees, with tenant notifications through a LINE Official Account. It is a one-semester student capstone built by 3-4 students, but the documents must be professional, precise, and directly usable.\n\n' +
  'Inputs — read each fully before doing anything (use cat / sed -n in chunks for long files):\n' +
  '- PRD (Thai, the contract for scope): ' + PRD + '\n' +
  (extra || '') +
  '- HTML template and CSS classes available to documents: ' + TEMPLATE + '\n\n' +
  'Conventions (binding):\n' +
  '- Documentation prose in English. Product UI copy (labels, buttons, LINE messages) in Thai because users are Thai; keep the English page identifiers the PRD uses (Login, Dashboard, Rooms, Tenants, Meter Reading, Monthly Billing, Bill Detail, Payment, Receipt, Announcements, Reports, Settings). Bill statuses are exactly Draft, Unpaid, Paid, Overdue.\n' +
  '- Currency THB, format 1,790.00 or 1,790 THB / ฿1,790 in UI; timezone Asia/Bangkok; Gregorian years (2026) as in the PRD.\n' +
  '- ' + DEMO + ' Use these exact numbers whenever an example is needed.\n' +
  '- The PRD out-of-scope list (§24) is absolute: no rent, no lease contracts, no mobile app, no payment gateway, cards, online banking, slip upload, QR payment, IoT/automatic meters, AI/ML.\n' +
  '- Diagrams: Mermaid inside <pre class="mermaid"> … </pre>, wrapped in <div class="diagram"> with a <div class="caption">. Keep each diagram under ~25 nodes; quote labels that contain parentheses, colons, or slashes; never use HTML tags inside Mermaid labels.\n' +
  '- Write HTML fragments with semantic tags and the template classes (table, .table-wrap, .callout(.note/.warn/.bad/.ok/.decision) with .title, .badge(.draft/.unpaid/.paid/.overdue/.ok/.warn/.bad/.info/.neutral/.water/.elec/.fee/.p0/.p1/.p2), .kv (dl/dt/dd), .grid + .card, .diagram, .tree, .steps, .formula, .checklist, details/summary). Escape < > & inside code blocks.\n' +
  '- Do not spawn sub-agents. Do not ask questions: decide, and record assumptions explicitly.\n' +
  '- Your final message is consumed by a script, not read by a human: return exactly what the task asks for and nothing else.\n\n'
}

const DECISION_INPUT = '- Product decision log (PM, binding): ' + DECISIONS_FILE + '\n'
const ADR_INPUT = '- Architecture Decision Record (binding for names, stack, conventions): ' + ADR_FILE + '\n'

function assemblePrompt(o) {
  return common('technical editor assembling "' + o.title + '"', o.extraInputs) +
  'Parallel authors wrote HTML fragments into ' + o.dir + '. Fragments, in the order they must appear: ' + o.order.map(f => o.dir + '/' + f + '.html').join(', ') + '.\n' +
  (o.also || '') +
  'Produce ' + o.out + ':\n' +
  '1. Copy the template verbatim. Replace {{TITLE}} with "' + o.title + '", {{ROLE}} with "' + o.role + '", {{DATE}} with "' + DATE + '", {{STATUS}} with "Draft v1.0", and {{BODY}} with: an intro <section id="intro"> (purpose, audience, how to read this document, a document map table linking each section), then every fragment in order, then <section id="appendix"> (references: PRD sections used, decision ids used; change log with one row dated ' + DATE + '). Keep the template <head>, <style>, header, TOC nav and scripts intact.\n' +
  '2. While merging: make names and identifiers consistent across fragments (' + (o.authority || 'the earlier-defined fragment') + ' wins), remove duplicated explanations, normalise heading levels (each fragment is one h2 section; h3/h4 inside), keep every table and diagram, and do not summarise away detail — this is a specification, not a digest.\n' +
  '3. Validate every Mermaid block by eye: balanced quotes and brackets, one statement per line, labels with parentheses/colons/slashes quoted, no HTML tags inside labels, erDiagram attribute types are single words. Fix any that would fail to render.\n' +
  '4. Verify the finished file with grep: no "{{" placeholders remain; the number of "<section" equals the number of "</section>"; every fragment id is present; no unescaped "<" inside <pre><code> blocks. Fix and re-check until clean.\n' +
  'Return a short report: file size in lines, the consistency changes you made, and any conflicts you could not resolve.'
}

function reviewPrompt(o) {
  return common('reviewer — ' + o.lens, o.extraInputs) +
  'Review ' + o.file + ' end to end (it is long; read all of it in chunks; do not skim).\n' +
  'Focus: ' + o.focus + '\n' +
  'Report only real problems. For each: severity (critical = wrong/contradictory rule, broken money logic, or missing required feature; high = would mislead an implementer; medium = inconsistency or gap; low = wording), location (section heading, table name, diagram caption, or decision/test id), the problem, and a concrete fix (what to change to what). Recompute every worked example yourself. Verify every cited decision id exists in ' + DECISIONS_FILE + ' and says what the doc claims. Do not report praise, style preferences, or things outside the PRD scope. Return REVIEW.'
}

function fixPrompt(o) {
  return common('editor applying review findings to ' + o.file) +
  'Apply the findings below to ' + o.file + ' by editing the file in place (surgical edits with the Edit tool or sed; keep the template head, header, TOC and scripts intact; keep all existing content that is not being corrected). Findings from different reviewers may overlap — apply each fix once. Skip a finding only when it is factually wrong or would violate the PRD; say why.\n' +
  (o.extra || '') +
  'After editing: grep that no "{{" placeholders remain, "<section" count equals "</section>" count, and the Mermaid blocks you touched are syntactically valid.\n' +
  'Findings:\n' + JSON.stringify(o.issues, null, 1) + '\n' +
  'Return a list: finding location → applied / skipped (reason).'
}

function codexWrapper(o) {
  // Thin Sonnet wrapper that runs Codex Sol. Returns Codex's output (or CODEX_FAILED: reason).
  return 'You are a thin wrapper around the Codex CLI. Do NOT do the task yourself; your only job is to run Codex and return its output.\n' +
  'Steps:\n' +
  '1. Write the prompt below, verbatim, to ' + PARTS + '/codex/' + o.key + '-prompt.md.\n' +
  '2. Run in Bash (timeout 600000 ms):\n   cd ' + ROOT + ' && codex exec -m gpt-5.6-sol -s read-only -o ' + PARTS + '/codex/' + o.key + '-out.md "$(cat ' + PARTS + '/codex/' + o.key + '-prompt.md)" </dev/null\n' +
  '   If it has not finished within the timeout, run it once more with run_in_background and poll with a Monitor/TaskOutput until it exits (max 15 minutes total).\n' +
  '3. If ' + PARTS + '/codex/' + o.key + '-out.md exists and is non-empty, return its full contents verbatim as your final message. Otherwise return exactly "CODEX_FAILED: " followed by the last 20 lines of the command output.\n\n' +
  '===== PROMPT FOR CODEX (write verbatim) =====\n' + o.prompt
}

// ================================================================ Clarify
phase('Clarify')
const LENSES = [
  { key: 'product', prefix: 'Q-P', title: 'product & operations lens', focus: 'business rules and policies an apartment office needs: money (rounding, partial payment, corrections after approval, refunds), dates (billing period, due-date rule, when Overdue applies, reminder timing), rooms and tenants (move-in/out mid-month, vacant rooms and the common fee, room size changes), rates (which rate applies when it changes), the name inconsistency UtilityHub vs Juristic platform, UI language, multi-building, reporting needs, receipt format and legal wording, what Admin vs Staff may each do.' },
  { key: 'engineering', prefix: 'Q-E', title: 'engineering & data lens', focus: 'data model and integration: first reading with no previous month, meter rollover/replacement, decimals in readings, one reading per room per period, previous-reading resolution, rate versioning, bill regeneration/idempotency, what is locked after approval, LINE account linking (how a tenant LINE userId is obtained without a mobile app), tenants without LINE, push vs multicast, delivery failures and retry, scheduler for reminders/overdue, auth (session vs JWT), roles, audit trail, concurrency (two staff editing), deployment constraints for a free-tier student project, backups.' },
  { key: 'ux-qa', prefix: 'Q-U', title: 'UX & QA lens', focus: 'user journeys per role and testability: staff meter-reading round on a phone (month selection, progress, validation when current < previous, editing before submit, submit-to-review flow and locking), admin review of readings vs bills (are readings approved separately from bills?), bulk generate/approve, confirmation dialogs for irreversible actions, payment counter flow (amount tendered/change?), receipt printing (paper size), announcement audience selection, dashboard KPI definitions and time ranges, empty/error states, acceptance criteria that are currently unmeasurable.' },
]
const found = (await parallel(LENSES.map(l => () => agent(
  common('question finder (' + l.title + ')') +
  'Task: read the PRD end to end and list every ambiguity, gap, contradiction, or unstated rule that must be resolved before the ' + l.title + ' can be satisfied. Focus: ' + l.focus + '\n' +
  'For each item give: id (' + l.prefix + '-01, ' + l.prefix + '-02, …), topic, the question, why it matters (the concrete consequence of leaving it undecided), 2-4 options, and your recommended option with a one-line reason. Prefer questions whose answers change what gets built or tested; skip trivia. Aim for 12-20 items. Return QUESTIONS.',
  { label: 'questions:' + l.key, phase: 'Clarify', model: M, schema: QUESTIONS })))).filter(Boolean).flatMap(r => r.questions)
log('Clarify: ' + found.length + ' open questions surfaced')
if (!found.length) throw new Error('no questions surfaced')

const draft = await agent(
  common('Lead of Product (PM)') +
  'You own every product decision the PRD leaves open. Three reviewers surfaced the questions below (JSON). Merge duplicates, then decide every one. Rules:\n' +
  '- The PRD is the contract: never expand scope past it and never reintroduce an out-of-scope item. When in doubt choose the simpler option that still satisfies the demo scenario and all 30 functions in PRD §18.\n' +
  '- One-semester capstone by 3-4 students: prefer decisions that are cheap to implement and easy to demo to professors.\n' +
  '- Every decision must be concrete enough that an engineer, a designer and a tester can act on it without asking again: state the rule, the numbers, the exact wording where wording matters (e.g. Thai LINE message text, receipt fields), and who may do it.\n' +
  '- Add decisions the reviewers missed if they are needed (product name to use everywhere, UI language, timezone, number/date formats, receipt numbering, default rates for the demo, seed data for the demo).\n' +
  '- Ids D-01, D-02, … grouped by topic (Naming & scope, Rooms & tenants, Meter readings, Rates, Billing & statuses, Payments & receipts, LINE & notifications, Roles & security, Dashboard & reports, Platform). "affects" lists which roles must act on it: engineer, designer, tester.\n' +
  'Return DECISIONS (decisions, assumptions, notes). Do not write any files in this step.\n\nQuestions:\n' + JSON.stringify(found, null, 1),
  { label: 'pm:decide', phase: 'Clarify', model: M, schema: DECISIONS })
if (!draft) throw new Error('PM draft failed')
log('Clarify: PM drafted ' + draft.decisions.length + ' decisions')

const critique = await agent(
  common('product decisions critic') +
  'Below is the PM\'s draft decision log. Attack it. Find: contradictions with the PRD (scope, flows, statuses, numbers, message wording), contradictions between decisions, decisions too vague to implement or to write a test for, missing decisions that would block the engineer, designer or tester, scope creep, and anything that makes the PRD §28 demo harder. Check especially: billing period & previous-reading rule, first-month handling, rollover, vacant rooms, rate versioning, Overdue timing, corrections after approval, partial payments, LINE linking, tenants without LINE, permissions per role. For each issue: severity, location (decision id or "missing"), problem, concrete fix (the decision text you would write). No praise. Return REVIEW.\n\nDraft:\n' + JSON.stringify(draft, null, 1),
  { label: 'pm:critic', phase: 'Clarify', model: M, schema: REVIEW })
const critIssues = critique ? critique.issues : []
log('Clarify: critic raised ' + critIssues.length + ' issues')

const decisions = await agent(
  common('Lead of Product (PM)') +
  'Finalize your decision log using the critic\'s findings: apply every critical/high fix; apply medium/low when you agree, otherwise record why not in notes. Keep ids stable; add new ids at the end of their topic group.\nThen:\n' +
  '1. Write the final log as JSON to ' + DECISIONS_FILE + ' (identical structure to your return value).\n' +
  '2. Write ' + PM_DOC + ': copy the template ' + TEMPLATE + ' verbatim, replace {{TITLE}}="Product Decisions & Scope", {{ROLE}}="Lead of Product", {{DATE}}="' + DATE + '", {{STATUS}}="Approved v1.0", and {{BODY}} with these sections (each a <section id> with an h2): Purpose & how to read; Product summary (elevator pitch from PRD §29 in English, the two official project titles from the PRD, and the product name decision); Scope (in-scope table from PRD §3/§18 and out-of-scope table from §24); Actors & roles (Admin/Juristic person, Staff/Technician, Tenant via LINE) with a capability matrix; End-to-end business flow (Mermaid flowchart of PRD §25 annotated with decision ids where a decision changes a step); Decision log (one table per topic: id, question, decision, rationale, affects — use .callout.decision for the 5 most consequential decisions); Assumptions; Deferred items (explicitly not decided now and why); Glossary (Thai term → English term used across all documents, including bill statuses and roles); Demo scenario (the PRD §28 numbers as a table, with the seed data the demo needs).\n' +
  '3. Verify with grep that no "{{" placeholders remain and the Mermaid block is valid.\n' +
  '4. Return the final DECISIONS structure.\n\nDraft:\n' + JSON.stringify(draft, null, 1) + '\n\nCritique:\n' + JSON.stringify(critIssues, null, 1),
  { label: 'pm:finalize+write', phase: 'Clarify', model: M, schema: DECISIONS })
if (!decisions) throw new Error('PM finalize failed')
log('Clarify: ' + decisions.decisions.length + ' final decisions → 01-product-decisions.html')

// ================================================================ Architecture
phase('Architecture')
function proposalTask(angle) {
  return 'Angle you must take: ' + angle + '\n' +
  'Produce an architecture proposal in Markdown. Cover:\n' +
  '1. Tech stack with exact choices and versions and a one-line rationale each: frontend, backend, database, ORM/query layer, auth, validation, LINE Messaging API SDK, scheduler, charts, receipt printing/PDF, hosting/deploy for a free/cheap student budget, dev tooling (lint, test). PRD §23 lists candidates (React/Next.js, Node+Express, MySQL, Session/JWT, Chart.js, Vercel/Render/Railway); you may deviate with justification but stay learnable by students.\n' +
  '2. High-level architecture: components and how they talk (Mermaid flowchart), request path, where the scheduler runs, where the LINE webhook lands.\n' +
  '3. Domain model outline: entities with key fields and relationships; bill state machine; how rates are versioned and resolved for a period; how the previous reading is resolved; receipt number generation; audit/notification logs.\n' +
  '4. Key flows as Mermaid sequence diagrams: monthly billing (readings → generate → approve & send → LINE), cash payment (confirm → receipt → LINE), LINE account linking, reminder/overdue scheduler.\n' +
  '5. Top-level module/folder layout.\n' +
  '6. Cross-cutting: auth & roles, validation, error format, idempotent LINE sends, audit trail, money/time handling, testing approach.\n' +
  '7. Risks and mitigations; what to cut first if time runs out.\n' +
  'Ground everything in the PRD and the PM decision log; cite decision ids (D-xx).'
}
const ANGLES = [
  { key: 'lean', angle: 'the simplest architecture that fully satisfies the PRD and every PM decision, with the fewest moving parts and the least new learning for a 3-4 student team in one semester.' },
  { key: 'robust', angle: 'correctness first: integrity of money and bill state, idempotent LINE sends, auditability, safe concurrent edits, rate versioning — while still buildable by students in one semester.' },
]
const proposalThunks = ANGLES.map(a => () => agent(
  common('Principal Software Engineer', DECISION_INPUT) + proposalTask(a.angle) + '\nSave the proposal to ' + PARTS + '/arch-' + a.key + '.md and return the full Markdown as your final message.',
  { label: 'arch:' + a.key, phase: 'Architecture', model: M }))
if (USE_CODEX) {
  proposalThunks.push(() => agent(codexWrapper({ key: 'arch',
    prompt: 'You are a principal software engineer. No sub-agents. Read fully: ' + PRD + ' (product requirements, Thai) and ' + DECISIONS_FILE + ' (binding product decisions, JSON). Context: a one-semester student capstone (3-4 students) building a web app for apartment water/electricity/common-area fee management with LINE Official Account notifications; cash payments only; out-of-scope list in PRD §24 is absolute.\n' + proposalTask('pragmatic senior engineer who has shipped LINE Messaging API integrations and billing systems in Thailand: pick what actually works in production and is cheap to host, and call out the traps students hit.') + '\nOutput the full proposal in Markdown as your final message.' }),
    { label: 'arch:codex-sol', phase: 'Architecture', model: 'sonnet', effort: 'low' }))
}
const proposals = (await parallel(proposalThunks)).filter(Boolean).filter(p => typeof p === 'string' && !p.startsWith('CODEX_FAILED') && p.length > 500)
log('Architecture: ' + proposals.length + ' proposals (codex ' + (USE_CODEX ? 'requested' : 'off') + ')')
if (!proposals.length) throw new Error('no architecture proposals')

const adr = await agent(
  common('architecture judge (principal engineer)', DECISION_INPUT) +
  proposals.length + ' independent architecture proposals are below. Score each 1-5 on: fit to PRD + decisions, buildability by students in one semester, correctness of billing/money handling, LINE integration soundness, operational simplicity and hosting cost, demo-friendliness. Pick the winner, then graft in the best ideas of the others wherever they improve it without adding complexity.\n' +
  'Write the result as an Architecture Decision Record in Markdown to ' + ADR_FILE + ' with: (1) final stack — exact choices and versions; (2) architecture diagram (Mermaid) and deployment topology; (3) domain model outline — every entity/table with key fields, and the enum values (roles, room status, bill status, reading status if any, notification types); (4) bill state machine; (5) top-level folder layout for frontend and backend; (6) conventions — naming (tables snake_case? API paths?), API style and base path, JSON envelope and error format, money (DECIMAL) and time (UTC storage, Asia/Bangkok display) handling, ids, date/period format; (7) key mechanisms — previous-reading resolution, rate versioning, bill generation idempotency, receipt numbering, LINE linking, idempotent sends, scheduler; (8) decisions with rationale and rejected alternatives; (9) scoring table. This ADR is the single source of truth for every downstream writer: be decisive and specific — no "either/or", no "could".\n' +
  'Return the full ADR text as your final message.\n\n' +
  proposals.map((p, i) => '===== PROPOSAL ' + (i + 1) + ' =====\n' + p).join('\n\n'),
  { label: 'arch:judge', phase: 'Architecture', model: M })
if (!adr) throw new Error('ADR failed')
log('Architecture: ADR written')

// ================================================================ Engineering track
const ENG_SECTIONS = [
  { id: 'overview', title: 'System Overview & Requirements', scope:
    '- Purpose; actors (Admin/Juristic person, Staff/Technician, Tenant via LINE); system context diagram (Mermaid, C4-context style) and container diagram.\n' +
    '- Functional requirements: table FR-01…FR-30 mapping one-to-one to the 30 functions in PRD §18 (same order), each with a one-line testable acceptance criterion and the owning module; then any additional FRs the decisions require (FR-31+), e.g. LINE account linking, notification log.\n' +
    '- Non-functional requirements with numbers (80-300 rooms, response time, availability, security, data integrity, mobile usability for staff, Thai language, observability, backup/restore).\n' +
    '- Out-of-scope constraints restated from PRD §24.\n' +
    '- Domain glossary and all enum values (from the ADR).' },
  { id: 'data-model', title: 'Data Model & Database', scope:
    '- ERD as Mermaid erDiagram covering every table in the ADR (users, rooms, tenants, meter readings, rates, bills, bill items, payments, receipts, announcements, LINE accounts, plus any billing period / audit / notification log tables the ADR defines).\n' +
    '- Per-table specification: columns, types, nullability, constraints, indexes, and why; then complete MySQL 8 DDL in one <pre><code> block (runnable, with foreign keys, unique constraints such as one reading per room per period, and CHECKs).\n' +
    '- Bill state machine (Mermaid stateDiagram-v2): transitions, who/what triggers, side effects (LINE message, receipt).\n' +
    '- Rules with examples: previous-reading resolution, rate versioning (effective_from) and the query that resolves the rate for a period, receipt number format and generation (REC-YYYYMM-NNNNNN), money as DECIMAL(12,2), UTC storage / Asia/Bangkok display, history and soft delete.\n' +
    '- Seed data for the demo scenario as SQL INSERTs (rates, room 205, tenant, previous readings) that yield exactly 1,790 THB.' },
  { id: 'api-spec', title: 'API Specification', scope:
    '- API conventions per the ADR (base path, auth mechanism, JSON envelope, error format with codes, pagination, validation error shape).\n' +
    '- Endpoint catalogue as tables per module: method, path, roles allowed, purpose. Then per-endpoint detail (request/response JSON with the demo numbers) for: login/logout/me, users, rooms CRUD, tenants CRUD and LINE link code, meter readings (list by period, previous reading, create/update, submit for review), billing (generate for period, list, detail, approve & send), payments (confirm cash), receipts (get, print view), announcements (create/send, history), dashboard summary, reports (top water, top electricity, unpaid list, monthly totals, room history), settings/rates (get, create new effective rate), LINE webhook.\n' +
    '- Role/permission matrix (Admin vs Staff) per endpoint group, and what the LINE webhook accepts.\n' +
    '- Validation rules table (current >= previous unless rollover flag; one reading per room per period; approve only from Draft; pay only Unpaid/Overdue; amount equals total; etc.).' },
  { id: 'billing-engine', title: 'Billing Engine & Business Rules', scope:
    '- Billing period definition and month selection; the generation algorithm step by step (pseudo-code) with idempotency (re-running for a period only recreates Draft bills, never touches Unpaid/Paid/Overdue).\n' +
    '- Formulas for water, electricity and common-area fee with rounding rules; worked examples with full arithmetic: the demo scenario plus at least four edge cases — first reading with no previous month, meter rollover/replacement, vacant room, tenant move-in/out mid-period, rate change between periods — each showing the resulting bill.\n' +
    '- Reading submission and review flow (Staff submit → Admin review) and what is locked when.\n' +
    '- Approval flow (Approve & Send): preconditions, what becomes immutable, how corrections work after approval per the decisions, sequence diagram.\n' +
    '- Cash payment flow: confirm → status Paid → receipt → LINE confirmation, sequence diagram; overdue rule and the daily scheduler; reminder rule.\n' +
    '- Dashboard and report definitions: exact formula or SQL for every KPI in PRD §16 and every chart/report in §17 (time ranges, which statuses count).' },
  { id: 'line-integration', title: 'LINE Official Account Integration & Notifications', scope:
    '- LINE Official Account + Messaging API setup: channel creation, channel access token & secret, webhook URL and signature verification, required env vars, dev setup with ngrok.\n' +
    '- Account linking: how a tenant\'s LINE userId is bound to a tenant record per the decisions (e.g. link code issued in Tenants page, tenant sends it to the OA, webhook validates and stores userId) — Mermaid sequence diagram; unlink/relink; tenants without LINE and what admins see.\n' +
    '- Message catalogue: bill issued, reminder before due, overdue, payment confirmed, announcement — each with the exact Thai text (PRD §11, §14, §15 wording, extended with room and amounts) and the trigger; a complete Flex Message JSON for the bill and for the receipt confirmation.\n' +
    '- Sending: push vs multicast, LINE rate limits and quotas (free plan message limits), retry with idempotency key, notification log table usage, delivery status shown to admins, failure handling.\n' +
    '- Scheduler: daily overdue marking and reminder N days before due — cron expressions, timezone handling, how it runs locally and in deployment, idempotency of the daily job.\n' +
    '- Testing LINE: mocking the Messaging API, simulating webhook events with curl (signed), test channel.' },
  { id: 'structure-and-plan', title: 'Project Structure, Environment & Implementation Plan', scope:
    '- Full folder structure tree (frontend and backend per the ADR) as <pre class="tree"> with a comment per folder/file group; naming conventions; where each module from the API spec lives.\n' +
    '- Dev environment: prerequisites, setup steps, .env.example listing every variable with meaning, scripts (dev, build, test, lint, migrate, seed), database migrations and seeding, running locally.\n' +
    '- Deployment topology (Mermaid) and step-by-step deploy on the chosen hosts, secrets, backups, monitoring/logging basics.\n' +
    '- Implementation plan: milestones M0…Mn with goal, tasks (.checklist), dependencies, demoable deliverable per milestone, estimates for 3-4 students, and a Mermaid gantt; suggested team split; the order that gets the PRD §28 demo working earliest.\n' +
    '- Quality strategy summary (unit for calculations, integration for API, e2e for demo), CI outline, definition of done, coding conventions.\n' +
    '- Risk register table (risk, impact, likelihood, mitigation, owner).' },
]
const ENG_REVIEW_LENSES = [
  { key: 'consistency', lens: 'internal consistency & correctness', focus: 'Data model vs API vs billing rules vs LINE design vs folder structure vs the ADR at ' + ADR_FILE + ': every table, column, enum value, endpoint and module used anywhere must exist with the same name where it is defined; state machine transitions must match the API and the billing flow; formulas must match PRD §6-9 and the decision log; DDL must be valid MySQL 8; Mermaid must be valid; worked examples must be arithmetically right.' },
  { key: 'completeness', lens: 'completeness against the PRD', focus: 'All 30 functions (PRD §18) traceable to FR ids, endpoints and rules; all 12 pages (§19) have backing endpoints; all notification types (§15), all dashboard KPIs and reports (§16-17), the four bill statuses (§20), all tables (§21), out-of-scope items (§24) honoured (nothing in scope that the PRD excludes), and every PM decision in ' + DECISIONS_FILE + ' reflected somewhere. Report each missing or contradicting item.' },
]
async function engineeringTrack() {
  const extra = DECISION_INPUT + ADR_INPUT
  const written = (await parallel(ENG_SECTIONS.map(s => () => agent(
    common('Principal Software Engineer — section author: ' + s.title, extra) +
    'Write the section "' + s.title + '" of the engineering specification as an HTML fragment (no html/head/body; start with <section id="' + s.id + '"><h2>' + s.title + '</h2> and end with </section>) to ' + PARTS + '/eng/' + s.id + '.html. Use the ADR\'s stack, names and conventions exactly — other authors are writing sibling sections in parallel from the same ADR, so any name you invent that the ADR does not define must be listed in your identifiers.\n' +
    'Scope of this section:\n' + s.scope + '\n' +
    'Quality bar: precise enough to implement from without asking questions; every rule has an example with numbers; cite decision ids (D-xx) where a rule comes from the decision log; use tables for anything enumerable; diagrams where a flow has more than three steps. Expect 300-700 lines of HTML.\n' +
    'Return SECTION: file, summary (5-10 lines), identifiers (every table, enum value, endpoint path, module or term you introduced that sibling sections must reuse).',
    { label: 'eng:' + s.id, phase: 'Engineering', model: M, schema: SECTION })))).filter(Boolean)
  log('Engineering: ' + written.length + '/' + ENG_SECTIONS.length + ' sections written')
  if (written.length < ENG_SECTIONS.length) log('Engineering: MISSING sections: ' + ENG_SECTIONS.filter(s => !written.some(w => w.file.includes(s.id))).map(s => s.id).join(', '))

  await agent(assemblePrompt({ title: 'Engineering Specification & Implementation Plan', role: 'Principal Software Engineer', dir: PARTS + '/eng', order: ENG_SECTIONS.map(s => s.id), out: ENG_DOC, extraInputs: extra, authority: 'the ADR, then the data-model fragment',
    also: 'Section authors reported these identifiers; reconcile any that conflict:\n' + written.map(w => w.file + ': ' + (w.identifiers || []).join(', ')).join('\n') + '\nAlso include, right after the intro, a condensed "Architecture Decisions" section (id="adr") rendered from ' + ADR_FILE + ' (stack table, architecture diagram, conventions, decisions with rejected alternatives).\n' }),
    { label: 'eng:assemble', phase: 'Engineering', model: M })

  const reviewThunks = ENG_REVIEW_LENSES.map(l => () => agent(reviewPrompt({ lens: l.lens, file: ENG_DOC, focus: l.focus, extraInputs: extra }), { label: 'eng:review:' + l.key, phase: 'Engineering', model: M, schema: REVIEW }))
  if (USE_CODEX) {
    reviewThunks.push(() => agent(codexWrapper({ key: 'eng-review',
      prompt: 'You are a principal engineer reviewing an engineering specification for a student capstone. No sub-agents. Read fully: ' + ENG_DOC + ' (the spec, HTML), ' + PRD + ' (requirements, Thai), ' + DECISIONS_FILE + ' (binding product decisions). Find real defects only: wrong or contradictory rules, broken money/billing logic, invalid MySQL DDL, API/data-model mismatches, LINE Messaging API misuse (webhook signature, push/multicast, quotas), scheduler/timezone bugs, missing PRD functions, scope violations of PRD §24, and arithmetic errors in worked examples (recompute them). Output a JSON array only, no prose: [{"severity":"critical|high|medium|low","location":"section/table/diagram","problem":"…","fix":"…"}].' }) +
      '\n\nAfter Codex returns, convert its output into the REVIEW structure (issues array with severity/location/problem/fix; verdict = "codex-sol"). If Codex failed, return REVIEW with an empty issues array and verdict "CODEX_FAILED".',
      { label: 'eng:review:codex-sol', phase: 'Engineering', model: 'sonnet', effort: 'low', schema: REVIEW }))
  }
  const reviews = (await parallel(reviewThunks)).filter(Boolean)
  const issues = reviews.flatMap(r => r.issues || []).filter(i => i.severity !== 'low')
  log('Engineering: ' + issues.length + ' non-low review findings from ' + reviews.length + ' reviewers')
  if (issues.length) await agent(fixPrompt({ file: ENG_DOC, issues, extra: 'Binding references: ' + DECISIONS_FILE + ', ' + ADR_FILE + ', ' + PRD + '.\n' }), { label: 'eng:fix', phase: 'Engineering', model: M })
  return { doc: ENG_DOC, sections: written.length, findings: issues.length, summaries: written.map(w => w.summary) }
}

// ================================================================ Design track
const SCREEN_GROUPS = [
  { id: 'auth-dashboard', title: 'Login & Dashboard', device: 'desktop', screens:
    '- Login (email/username + password, error state, Thai labels).\n' +
    '- Dashboard: KPI tiles exactly as PRD §16 (rooms total/occupied/vacant, water/electricity/common totals for the selected month, billed, paid, outstanding), monthly water and electricity usage charts as inline SVG bar charts (12 months), Paid/Unpaid/Overdue donut, overdue rooms list, quick actions; month selector. If a Skill tool is available, load the "dataviz" skill before drawing the charts.' },
  { id: 'rooms-tenants', title: 'Rooms & Tenants', device: 'desktop', screens:
    '- Rooms list (table: room, floor, type, size sqm, tenant, status Occupied/Vacant; search/filter; add room).\n' +
    '- Room detail (info, current tenant, meter history table + mini usage chart, bills history with status badges, actions).\n' +
    '- Room form (create/edit with validation).\n' +
    '- Tenants list (name, phone, room, move-in date, LINE link status).\n' +
    '- Tenant form + detail (assign room, move-in/out, LINE link code panel showing how the tenant links per the decisions, unlink).' },
  { id: 'meter-reading', title: 'Meter Reading (Staff, mobile)', device: 'phone', screens:
    '- Period/month selection and reading-round list (rooms with done/pending state, progress bar, search).\n' +
    '- Reading entry for Room 205: previous water 1,250 and electricity 5,280 shown, large numeric inputs, live computed units (10 and 70) and amounts, save; validation states (current lower than previous → rollover/replacement confirm per decisions; empty; non-numeric).\n' +
    '- Review & submit for the period (summary, anomalies flagged e.g. usage far above last month), submitted/locked state, and what a staff member sees if Admin returns readings for correction (per decisions).\n' +
    '- Bottom tab navigation for Staff role.' },
  { id: 'billing', title: 'Monthly Billing & Bill Detail', device: 'desktop', screens:
    '- Monthly Billing list: month picker, Generate bills action with confirmation, table per PRD §19.6 (room, water, electricity, common, total, status badges Draft/Unpaid/Paid/Overdue), filters, bulk Approve & Send if the decisions allow it, LINE delivery status column.\n' +
    '- Bill Detail for room 205: full calculation breakdown (previous/current readings, units, rates, room size, common fee, total 1,790), tenant + LINE status, Approve & Send button with confirmation dialog (what will be sent, Thai preview), post-approval state (locked, sent timestamp), correction path per decisions, payment history.' },
  { id: 'payment-receipt', title: 'Payment & Receipt', device: 'desktop', screens:
    '- Payment: search by room number/tenant, list of that room\'s open bills with amounts, select bill (Unpaid — 1,790 THB), Confirm Cash Payment dialog (amount received per decisions, received by, date/time), success state with Print Receipt and LINE confirmation status.\n' +
    '- Receipt view and a separate print layout (use <div class="device print">) with receipt number REC-202609-000852, apartment info, room 205, line items, total, payment method Cash, paid date 3/09/2026, received by, per the decisions on paper size.\n' +
    '- Payment history (list, filters, reprint).' },
  { id: 'announce-reports-settings', title: 'Announcements, Reports & Settings', device: 'desktop', screens:
    '- Announcements: compose (title, Thai message, audience: all rooms / selected rooms / floor per decisions), live LINE bubble preview, send with confirmation, history table with delivery counts.\n' +
    '- Reports: filters (month range), top water usage rooms, top electricity usage rooms, unpaid/overdue rooms list, monthly revenue chart (inline SVG), per-room usage history table; export per decisions.\n' +
    '- Settings: rates (water/unit, electricity/unit, common/sqm) with effective-from date and history table, due-date rule, reminder days, apartment info (name, address, phone, receipt footer), users & roles management (list, create user, role Admin/Staff, deactivate).' },
  { id: 'line-messages', title: 'LINE Official Account Messages (Tenant)', device: 'phone', screens:
    '- LINE chat mockups (use the .line-chat / .bubble / .flex-card classes from tokens.css) for: bill issued (Flex card with the PRD §11 content: room 205, water 180, electricity 560, common 1,050, total 1,790, due 5 กันยายน 2026, pay cash at office), reminder before due (PRD §15 wording), overdue (⚠️ คุณมียอดค้างชำระ 1,790 บาท), payment confirmed (PRD §14 wording, 3 กันยายน 2026), announcement (PRD §15 example).\n' +
    '- Account linking conversation (tenant adds OA, sends link code, OA confirms; wrong code; already linked) per the decisions.\n' +
    '- Rich menu mockup if the decisions include one; a "what the tenant experiences" flow strip (Mermaid journey or flowchart).' },
]
const DESIGN_REVIEW_LENSES = [
  { key: 'ux', lens: 'UX completeness & consistency', focus: 'Every PRD §19 page and every Staff/Admin capability in PRD §4 has a screen; flows match the decision log (' + DECISIONS_FILE + ') and the ADR routes/roles (' + ADR_FILE + '); Thai copy is consistent across screens and matches the PRD message wording; status names/colours are consistent; the demo scenario numbers appear correctly; irreversible actions have confirmations; mobile screens are usable one-handed; nothing out of scope (PRD §24) appears in the UI.' },
  { key: 'a11y-html', lens: 'accessibility & mockup integrity', focus: 'Contrast of text on backgrounds, touch targets ≥ 44px on mobile screens, labels on every input, focus/error states described, colour never the only status cue; and HTML integrity of the mockups — unclosed tags, elements escaping their .device frame, CSS from tokens.css leaking into the document (must be scoped under .screen), broken inline SVG, fixed heights that clip content.' },
]
async function designTrack() {
  const extra = DECISION_INPUT + ADR_INPUT
  const cheat = await agent(
    common('Senior Product Designer — design foundations', extra) +
    'Deliverables:\n' +
    '1. ' + PARTS + '/design/tokens.css — the PRODUCT UI design system, every rule scoped under .screen so it can never collide with the document styles (e.g. ".screen .btn", ".screen .table"). Include: colour tokens as CSS custom properties on .screen (brand, water / electricity / common-fee accents, status colours for Draft/Unpaid/Paid/Overdue and Occupied/Vacant, semantic success/warning/danger), a Thai-friendly font stack ("Noto Sans Thai", "Inter", sans-serif), type scale, spacing scale, radius, shadows; component classes: layout (.app with sidebar .sidebar + .main for desktop, .topbar, .bottom-tabs for mobile), .btn variants (primary/secondary/danger/ghost, sizes), .input/.select/.field with label + hint + error, .card, .table (compact, zebra, .num right-aligned), .badge variants for every status, .kpi tile, .toast, .modal/.dialog, .empty-state, .stepper, .progress, .chip, .list-item; LINE chat mockup classes (.line-chat with the LINE green header, .bubble.oa, .bubble.user, .flex-card with header/body/footer/button, .rich-menu); print receipt classes (.receipt). Keep it around 300-450 lines, consistent, no external assets.\n' +
    '2. ' + PARTS + '/design/foundations.html fragment (<section id="foundations"><h2>Design Foundations & User Flows</h2>…</section>): design principles (mobile-first for staff, one-hand meter entry, error prevention on money actions, Thai-first copy, glanceable status); three personas (Admin/Juristic person, Staff/Technician, Tenant) with goals and frustrations; site map (Mermaid) with routes from the ADR; navigation model per role; user-flow diagrams (Mermaid flowcharts) for: staff meter-reading round, admin monthly billing & Approve & Send, cash payment & receipt, tenant LINE account linking, tenant journey from bill to confirmation, announcement; interaction rules (validation timing, error and empty states, loading, confirmation dialogs for Approve & Send and Confirm Cash Payment, undo where safe); visual language rendered live with the tokens (colour swatches, type samples, spacing) inside <div class="device desktop"><div class="screen">…</div></div>; component inventory rendered live (every component class shown once, in all states); accessibility rules (contrast, 44px targets, focus order, labels, status not by colour alone); responsive breakpoints.\n' +
    'Return, as your final message, a compact cheat-sheet for screen authors: every custom property and component class name in tokens.css with a one-line usage note (no CSS bodies).',
    { label: 'design:foundations', phase: 'Design', model: M })
  if (!cheat) throw new Error('design foundations failed')
  log('Design: foundations + tokens.css ready')

  const screens = (await parallel(SCREEN_GROUPS.map(g => () => agent(
    common('Senior Product Designer — screens: ' + g.title, extra) +
    'Read ' + PARTS + '/design/tokens.css (the product design system; use only its classes and custom properties for mockup styling — add a small <style> only for layout specifics unique to your screens, still scoped under .screen). Cheat-sheet from the foundations author:\n' + cheat + '\n\n' +
    'Write ' + PARTS + '/design/' + g.id + '.html as a fragment: <section id="' + g.id + '"><h2>' + g.title + '</h2>…</section>. For EACH screen: <h3> with the screen name (and route from the ADR), a .screen-meta line (role, entry points, primary action), a high-fidelity HTML mockup inside <div class="device ' + g.device + '">' + (g.device === 'desktop' ? '<div class="chrome"><i></i><i></i><i></i><span class="url">app.juristic.local/…</span></div>' : '') + '<div class="screen">…</div></div> built with HTML + tokens.css classes only (no images, no external libraries; inline SVG for icons and charts is fine), populated with realistic Thai data (room 205, Thai tenant names, the demo numbers), with numbered <span class="ann">n</span> markers positioned on key elements (give the .screen position:relative) and a matching <ol class="annotations"> explaining each: what it is, behaviour on interaction, validation, and resulting state. Then a states table (empty / loading / error / success / permission denied) and the exact Thai copy for buttons, titles, validation and confirmation dialogs. Mobile screens are 390px wide, desktop 1200px (the .device frame sets the width; design the .screen content for it). Show at least one alternate state per screen (e.g. the confirmation dialog open, or an error) as a second device frame when it matters.\n' +
    'Screens to produce:\n' + g.screens + '\n' +
    'Validate: every tag closed, nothing escapes the .device frame, no CSS outside .screen scope, no "{{". Return a 5-line summary plus the list of screen h3 titles you produced.',
    { label: 'design:' + g.id, phase: 'Design', model: M })))).filter(Boolean)
  log('Design: ' + screens.length + '/' + SCREEN_GROUPS.length + ' screen groups written')

  await agent(assemblePrompt({ title: 'UI Design, Mockups & User Flows', role: 'Senior Product Designer', dir: PARTS + '/design', order: ['foundations'].concat(SCREEN_GROUPS.map(g => g.id)), out: DESIGN_DOC, extraInputs: extra, authority: 'foundations.html and the ADR',
    also: 'Inline the entire contents of ' + PARTS + '/design/tokens.css into a second <style> block placed immediately after the template\'s own <style> (this document must be self-contained). Screen authors\' summaries:\n' + screens.join('\n---\n') + '\nAlso append, inside the appendix, a screen index table (screen, route from the ADR, role, device, states covered) built from every h3 in the screen sections.\n' }),
    { label: 'design:assemble', phase: 'Design', model: M })

  const reviews = (await parallel(DESIGN_REVIEW_LENSES.map(l => () => agent(reviewPrompt({ lens: l.lens, file: DESIGN_DOC, focus: l.focus, extraInputs: extra }), { label: 'design:review:' + l.key, phase: 'Design', model: M, schema: REVIEW })))).filter(Boolean)
  const issues = reviews.flatMap(r => r.issues || []).filter(i => i.severity !== 'low')
  log('Design: ' + issues.length + ' non-low review findings')
  if (issues.length) await agent(fixPrompt({ file: DESIGN_DOC, issues, extra: 'Binding references: ' + DECISIONS_FILE + ', ' + ADR_FILE + ', ' + PRD + '. Keep mockup CSS scoped under .screen.\n' }), { label: 'design:fix', phase: 'Design', model: M })
  return { doc: DESIGN_DOC, groups: screens.length, findings: issues.length }
}

// Engineering and Design both depend only on the ADR + decisions: run them side by side.
phase('Engineering')
const [eng, design] = await parallel([() => engineeringTrack(), () => designTrack()])
if (!eng || !design) log('WARNING: a track failed — eng=' + !!eng + ' design=' + !!design)

// ================================================================ Testing
phase('Testing')
const TEST_AREAS = [
  { id: 'tc-auth-settings', prefix: 'AUTH', title: 'Authentication, Users, Roles & Settings', scope: 'login/logout/session expiry, wrong password, locked/deactivated user; role-based access for every page and endpoint group (Admin vs Staff, and unauthenticated); user management CRUD; settings: rates with effective-from dates and history (which rate a period resolves to), due-date rule, reminder days, apartment info used on receipts.' },
  { id: 'tc-rooms-readings', prefix: 'ROOM', title: 'Rooms, Tenants & Meter Readings', scope: 'rooms CRUD, size validation, Occupied/Vacant status rules; tenants CRUD, assign/move-in/move-out, LINE link states (unlinked/linked/relink, wrong code, expired code); meter reading round: period selection, previous-reading resolution (including first month, vacant→occupied), entry validation (lower than previous, rollover/replacement path, decimals, non-numeric, empty), one reading per room per period, edit before submit, submit-for-review lock, Admin return-for-correction, concurrent edits.' },
  { id: 'tc-billing', prefix: 'BILL', title: 'Billing Calculation & Bill Lifecycle', scope: 'bill generation per period and idempotency (regenerate only Draft), water/electricity/common-area calculations with the demo scenario and every edge case in the engineering spec (first reading, rollover, vacant room, mid-period move, rate change) with exact expected amounts, bill items, totals and rounding; state machine Draft→Unpaid→Paid / Overdue→Paid and every illegal transition; Approve & Send preconditions and immutability; corrections after approval per decisions; overdue daily job (date boundaries, timezone); dashboard KPI formulas and report figures.' },
  { id: 'tc-payment-line', prefix: 'PAY', title: 'Payments, Receipts, LINE Notifications, Announcements & Reports', scope: 'confirm cash payment (amount rules, who, when, double-confirm prevention), receipt numbering sequence and uniqueness, receipt content and print view, payment history; LINE: bill message content and trigger, reminder timing, overdue message, payment confirmation, announcement to audiences, unlinked tenant handling, send failure/retry and notification log visibility, webhook signature verification and link-code handling; reports: top water/electricity rooms, unpaid list, monthly revenue, room history; history views of readings and payments.' },
]
const REUSE = f => 'A previous attempt already wrote ' + PARTS + '/test/' + f + ' before being cut off. First check whether it exists. If it does: read it fully, verify it is complete (starts with <section, ends with </section>, tags balanced, no "{{", every item of the scope below covered with concrete expected values), repair or extend only what is missing or wrong, and then return SECTION for it — do NOT rewrite it from scratch. Only if the file is missing or clearly truncated, write it as specified: '
const TEST_INPUTS = DECISION_INPUT + ADR_INPUT + '- Engineering specification (FR ids, endpoints, rules, edge cases): ' + ENG_DOC + '\n- UI design (screens, routes, Thai copy, states): ' + DESIGN_DOC + '\n'
const testParts = (await parallel(TEST_AREAS.map(a => () => agent(
  common('Senior QA Engineer — test cases: ' + a.title, TEST_INPUTS) +
  REUSE(a.id + '.html') + 'Write ' + PARTS + '/test/' + a.id + '.html as a fragment: <section id="' + a.id + '"><h2>' + a.title + '</h2>…</section>. Organise by feature (h3). For each feature a test case table with columns: ID (TC-' + a.prefix + '-001, -002, …), Title, Type (unit / API / UI / e2e), Priority (P0 = demo-critical or money, P1, P2 — use .badge.p0/.p1/.p2), Preconditions, Steps (numbered), Test data (exact values), Expected result (exact values, status, message text), Traces to (FR-xx from the engineering spec and D-xx from the decision log). Cover happy paths, validation, permissions (Admin vs Staff vs unauthenticated), edge cases, negative cases and error messages. Every calculation test states the arithmetic. Reuse the exact endpoint paths, screen names, Thai copy and enum values from the spec and the design.\n' +
  'Areas: ' + a.scope + '\n' +
  'Aim for 40-70 test cases. Return SECTION: file, summary, identifiers (TC id range, FR ids and D ids covered).',
  { label: 'test:' + a.id, phase: 'Testing', model: M, schema: SECTION }))
  .concat([() => agent(
    common('Senior QA Engineer — test strategy & end-to-end automation', TEST_INPUTS) +
    REUSE('e2e.html') + 'Write ' + PARTS + '/test/e2e.html as a fragment with two sections: <section id="strategy"><h2>Test Strategy</h2> — objectives, test pyramid (what is unit / integration / e2e and why, tools exactly as the ADR names them), environments, test data and a seed fixture for the demo scenario, LINE mocking approach (stub the Messaging API client in unit/integration tests; a fake LINE server or recorded fixture for e2e; simulating signed webhook events with a script), clock control for due/overdue tests, entry/exit criteria, defect severity definitions, traceability approach, CI pipeline (GitHub Actions YAML that runs lint, unit, API and e2e with MySQL service).</section> and <section id="e2e"><h2>End-to-End Scenarios</h2> — a scenarios table (E2E-01…): the complete PRD §28 demo (staff reads meters → submits → admin generates → reviews Bill Detail → Approve & Send → LINE bill received → cash payment confirmed → receipt REC-202609-000852 → LINE confirmation → dashboard/report updated), overdue flow with clock advance and reminder, correction after approval, permission denial (Staff tries Approve), LINE unlinked tenant, announcement to selected rooms, idempotent regeneration; each with preconditions, steps and assertions. Then complete Playwright (TypeScript) code for E2E-01 with page objects and API fixtures (routes and selectors consistent with the design doc), an API integration test example for bill generation, and unit tests for the three formulas, rollover and rate resolution.</section>\n' +
    'Return SECTION: file, summary, identifiers (E2E ids).',
    { label: 'test:e2e-strategy', phase: 'Testing', model: M, schema: SECTION })]))).filter(Boolean)
log('Testing: ' + testParts.length + '/' + (TEST_AREAS.length + 1) + ' fragments written')

await agent(assemblePrompt({ title: 'Test Plan, Test Cases & E2E Automation', role: 'Senior QA Engineer', dir: PARTS + '/test', order: ['e2e'].concat(TEST_AREAS.map(a => a.id)), out: TEST_DOC, extraInputs: TEST_INPUTS, authority: 'the engineering spec FR ids and the decision log',
  also: 'Note e2e.html contains two sections (strategy, e2e): place "strategy" first, then the four test-case sections, then "e2e". Authors reported: ' + testParts.map(t => t.file + ': ' + (t.identifiers || []).join(', ')).join('\n') + '\nBuild a <section id="traceability"> before the appendix: a matrix FR-01…FR-30 (and FR-31+ if present, from ' + ENG_DOC + ') → list of TC and E2E ids covering it, with a .badge.bad "GAP" for any FR with no coverage; also D-xx decisions → TC ids. Renumber duplicate TC ids if two authors collided.\n' }),
  { label: 'test:assemble', phase: 'Testing', model: M })

const testReview = await agent(reviewPrompt({ lens: 'test coverage & precision', file: TEST_DOC, extraInputs: TEST_INPUTS, focus: 'Every FR-01…FR-30 and every decision that changes behaviour has at least one P0/P1 test; expected results are exact (values, statuses, Thai messages) and arithmetically correct; endpoint paths, screen names and enum values match the engineering spec and design doc; illegal state transitions and permission denials are covered; the E2E-01 demo scenario ends with 1,790 THB paid and receipt REC-202609-000852; the traceability matrix has no unexplained GAP; the Playwright/unit code is coherent with the ADR stack.' }), { label: 'test:review', phase: 'Testing', model: M, schema: REVIEW })
const testIssues = testReview ? (testReview.issues || []).filter(i => i.severity !== 'low') : []
log('Testing: ' + testIssues.length + ' non-low review findings')
if (testIssues.length) await agent(fixPrompt({ file: TEST_DOC, issues: testIssues, extra: 'Binding references: ' + ENG_DOC + ', ' + DESIGN_DOC + ', ' + DECISIONS_FILE + '.\n' }), { label: 'test:fix', phase: 'Testing', model: M })

// ================================================================ Integrate
phase('Integrate')
const ALL_DOCS = [PM_DOC, ENG_DOC, DESIGN_DOC, TEST_DOC]
const xdoc = await agent(
  common('cross-document consistency reviewer', DECISION_INPUT + ADR_INPUT) +
  'Read all four documents fully: ' + ALL_DOCS.join(', ') + '. Find contradictions BETWEEN documents: product name; role names; bill/room status names and colours; page names and routes; entity/table/field names; endpoint paths; decision ids cited with a different meaning; FR ids cited in the test plan that do not exist in the spec; the demo scenario numbers, dates, due date and receipt number; the exact Thai text of each LINE message (must be identical in the spec, the design mockups and the test expectations); rate values; due-date and reminder rules; what Staff may do. For each: severity, location as "file → section", problem, fix (which document should change, to what — the decision log wins on product rules, the ADR on technical names, the engineering spec on Thai LINE wording unless the PRD wording differs). Return REVIEW.',
  { label: 'integrate:consistency', phase: 'Integrate', model: M, schema: REVIEW })
const xIssues = xdoc ? (xdoc.issues || []).filter(i => i.severity !== 'low') : []
log('Integrate: ' + xIssues.length + ' cross-document findings')
if (xIssues.length) await agent(
  common('editor applying cross-document fixes') +
  'Apply each finding to the document it names (edit in place; keep template heads/scripts intact; keep all other content). Findings:\n' + JSON.stringify(xIssues, null, 1) + '\nAfter editing, grep each touched file for "{{" and balanced <section> tags. Return: finding → applied / skipped (reason).',
  { label: 'integrate:fix', phase: 'Integrate', model: M })

await agent(
  common('documentation lead writing the index page', DECISION_INPUT) +
  'Read the first ~150 lines and every h2 of each document: ' + ALL_DOCS.join(', ') + '. Write ' + INDEX_DOC + ' from the template ({{TITLE}}="Documentation Home", {{ROLE}}="Documentation team", {{DATE}}="' + DATE + '", {{STATUS}}="v1.0"): the project titles in Thai and English (from the PRD) and the product name per the decision log; a one-paragraph product summary; the team roles (Lead of Product, Principal Software Engineer, Senior Product Designer, Senior QA Engineer) and what each owns; a .grid of .card links to the four documents (relative hrefs: 01-product-decisions.html, 02-engineering-spec.html, 03-ui-design.html, 04-test-plan.html, plus PRD.md) each with a 3-line summary and its section list; a suggested reading order for a new team member, for a professor, and for a developer starting M1; the demo scenario at a glance (table with the numbers and the short presentation flow from PRD §26 as a Mermaid flowchart); document conventions (statuses, ids FR/D/TC/E2E, how to open the files, that Mermaid needs internet for the CDN). Verify no "{{" remains. Return "ok".',
  { label: 'integrate:index', phase: 'Integrate', model: M })

const critic = await agent(
  common('completeness critic', DECISION_INPUT + ADR_INPUT) +
  'The team believes the documentation set is complete: ' + ALL_DOCS.join(', ') + ' and ' + INDEX_DOC + '. Prove them wrong. Read everything and answer: what is missing that a student team would need before writing code in week 1? Check at minimum: every PRD §18 function has an FR, an endpoint, a screen and a test; every §19 page has a mockup; every §15 notification has exact Thai copy, a trigger, and a test; the §28 demo is executable end to end through the documents (seed data → readings → bill → approval → LINE → payment → receipt → dashboard) with matching numbers everywhere; setup instructions are complete (env vars, LINE channel steps, DB); the implementation plan covers every FR; nothing out of scope slipped in; diagrams referenced in text exist. Report only concrete gaps and contradictions with severity, "file → section" location, problem and fix. Return REVIEW.',
  { label: 'integrate:critic', phase: 'Integrate', model: M, schema: REVIEW })
const criticIssues = critic ? (critic.issues || []) : []
const seriousGaps = criticIssues.filter(i => i.severity === 'critical' || i.severity === 'high')
log('Integrate: critic found ' + criticIssues.length + ' gaps (' + seriousGaps.length + ' critical/high)')
if (seriousGaps.length) await agent(
  common('editor closing completeness gaps', DECISION_INPUT + ADR_INPUT) +
  'Close each gap below by adding or correcting content in the document it names (write real content — rules with numbers, Thai copy, tables — not placeholders; keep template heads/scripts intact). Findings:\n' + JSON.stringify(seriousGaps, null, 1) + '\nAfter editing, grep each touched file for "{{" and balanced <section> tags. Return: gap → closed / skipped (reason).',
  { label: 'integrate:close-gaps', phase: 'Integrate', model: M })

return {
  docs: ALL_DOCS.concat([INDEX_DOC]),
  questions: found.length, decisions: decisions.decisions.length, proposals: proposals.length,
  engineering: eng, design: design,
  testFragments: testParts.length, testFindings: testIssues.length,
  crossDocFindings: xIssues.length,
  remainingGaps: criticIssues.filter(i => !(i.severity === 'critical' || i.severity === 'high')),
  closedGaps: seriousGaps.length,
}
