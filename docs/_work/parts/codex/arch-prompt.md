You are a principal software engineer. No sub-agents. Read fully: /Users/peach/Documents/popo/juristic-platform/docs/PRD.md (product requirements, Thai) and /private/tmp/claude-501/-Users-peach-Documents-popo-juristic-platform/a8e6b2a2-384a-47c4-9b05-d49ed1b7d937/scratchpad/parts/decisions.json (binding product decisions, JSON). Context: a one-semester student capstone (3-4 students) building a web app for apartment water/electricity/common-area fee management with LINE Official Account notifications; cash payments only; out-of-scope list in PRD §24 is absolute.
Angle you must take: pragmatic senior engineer who has shipped LINE Messaging API integrations and billing systems in Thailand: pick what actually works in production and is cheap to host, and call out the traps students hit.
Produce an architecture proposal in Markdown. Cover:
1. Tech stack with exact choices and versions and a one-line rationale each: frontend, backend, database, ORM/query layer, auth, validation, LINE Messaging API SDK, scheduler, charts, receipt printing/PDF, hosting/deploy for a free/cheap student budget, dev tooling (lint, test). PRD §23 lists candidates (React/Next.js, Node+Express, MySQL, Session/JWT, Chart.js, Vercel/Render/Railway); you may deviate with justification but stay learnable by students.
2. High-level architecture: components and how they talk (Mermaid flowchart), request path, where the scheduler runs, where the LINE webhook lands.
3. Domain model outline: entities with key fields and relationships; bill state machine; how rates are versioned and resolved for a period; how the previous reading is resolved; receipt number generation; audit/notification logs.
4. Key flows as Mermaid sequence diagrams: monthly billing (readings → generate → approve & send → LINE), cash payment (confirm → receipt → LINE), LINE account linking, reminder/overdue scheduler.
5. Top-level module/folder layout.
6. Cross-cutting: auth & roles, validation, error format, idempotent LINE sends, audit trail, money/time handling, testing approach.
7. Risks and mitigations; what to cut first if time runs out.
Ground everything in the PRD and the PM decision log; cite decision ids (D-xx).
Output the full proposal in Markdown as your final message.
