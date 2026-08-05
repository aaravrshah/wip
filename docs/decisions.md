# WIP decisions, assumptions, and open questions

Last updated: 2026-08-04

## How to use this log

- **Confirmed** means stated by the product owner or required by the Milestone 0 brief.
- **Proposed** means the recommended default used to make the specifications implementable, but owner approval is still required.
- **Open** means implementation must not silently choose an answer if the choice materially changes product behavior, privacy, permissions, or architecture.
- When a decision changes, append a dated replacement entry and mark the older entry superseded; do not erase the history.

## Confirmed decisions

| ID | Decision | Rationale / consequence |
| --- | --- | --- |
| C-001 | “WIP” / “wip” is a working name only. | Do not assume trademark/domain availability or embed a final public brand in irreversible infrastructure. |
| C-002 | The product will be a responsive web app plus a Chrome extension. | Web is the persistent tracker; extension supports browser capture. Native mobile apps are not in scope. |
| C-003 | Recent graduates and early-career applicants are the initial audience, while the model remains general. | Copy can welcome early-career users, but schema/status logic cannot depend on student-only fields or linear processes. |
| C-004 | The product preserves exact job-description snapshots and chronological application history. | Snapshots must be immutable; status must not overwrite source history. |
| C-005 | Users track application confirmations/status changes, document versions, reminders, and next actions. | These are core product concepts and must be first-class in the data model and detail experience. |
| C-006 | Forwarded recruiting email is a later feature. Extraction includes confidence and requires user approval for uncertain status updates. | Email ingestion is Milestone 3 and cannot silently mutate status. The proposed stricter initial rule requires confirmation for all automated status changes. |
| C-007 | Aggregate hiring statistics are optional and use de-identified, contributed events. | Hiring Pulse contribution is off by default and separate from ordinary product/analytics consent. |
| C-008 | WIP will not implement auto-apply, mass application submission, resume generation, native mobile apps, job discovery, or broad LinkedIn scraping in the scoped roadmap. | Product and permission scope must not drift into these areas. |
| C-009 | TypeScript is the default implementation language, with simple testable code, narrow permissions, and required lint/type/test gates. | Recorded in `AGENTS.md`; SQL/configuration remain appropriate exceptions. |
| C-010 | WIP must not store applicant EEO answers, disability status, veteran status, Social Security number, or birthdate. | Do not create fields, inference, logs, fixtures, or analytics dimensions for these data. Employer EEO boilerplate may be incidentally present only inside a job-post snapshot. |
| C-011 | Product/architecture documentation changes with product or architectural decisions. | Durable changes update the relevant spec and this log in the same change. |
| C-012 | Milestones are ordered: manual web tracker, Chrome capture, forwarded-email proposals, then Hiring Pulse aggregates. | Later infrastructure and permissions are deliberately deferred. |

## Proposed decisions requiring approval

| ID | Proposed decision | Why this default | Consequence if approved |
| --- | --- | --- | --- |
| P-001 | Define an “exact snapshot” as immutable sanitized job-description HTML plus plain text, source/canonical URL, page title, capture time, extractor version, metadata, and content hash—not a screenshot or full-page archive. | Preserves the content the user needs while excluding scripts, trackers, cookies, unrelated page text, and brittle visual assets. | Milestone 1 paste and Milestone 2 capture target semantic fidelity; screenshots/WARC remain out of scope. |
| P-002 | Use stages `saved`, `preparing`, `applied`, `interviewing`, `offer`, `accepted`, `rejected`, and `withdrawn`; keep archive separate and treat no-response as a derived signal. | Small, general vocabulary that can be projected from richer events without forcing every employer process into identical steps. | Table/Kanban columns and reducer tests use these names. |
| P-003 | Treat the launch MVP as Milestones 1 and 2, with Milestone 1 independently useful. | The full promise includes capture, but manual usefulness should not depend on extension approval/distribution. | Email and Hiring Pulse remain post-MVP. |
| P-004 | Use pnpm + Turborepo, Next.js App Router on Vercel, and Supabase Postgres/Auth/RLS. | Lowest integration burden for a solo TypeScript developer, low early infrastructure cost, and portable Postgres data. | Milestone 1 scaffolding follows `docs/architecture.md`; pricing/terms are checked before provisioning. |
| P-005 | Use WXT for the MV3 extension with a popup, `activeTab`, `scripting`, `storage`, a narrow WIP API host, and likely `identity`; never request `<all_urls>` for the capture flow. | Good TypeScript extension workflow while preserving Chrome's temporary-access privacy model. | Extension authentication is threat-modeled at Milestone 2 start. |
| P-006 | Route all external mutations through versioned `/api/v1` command handlers, keep event/domain logic shared, and use RLS as defense in depth. | The extension and later workers need stable HTTP contracts; one write path keeps validation and audit consistent. | Direct browser database writes, if any, are limited to deliberately approved reads or narrow operations. |
| P-007 | Require user confirmation for every email-derived status-changing event in Milestone 3, regardless of confidence. | Safer and simpler than calibrating an auto-approval threshold before real-world extraction quality is known. | Confidence explains and sorts suggestions but never authorizes them. |
| P-008 | Keep resume/cover-letter content out of the initial beta; store version metadata, filename/hash/reference, and exact application association only. | Satisfies “which version?” with substantially less sensitive content and storage risk. | File upload needs a later explicit security/privacy decision. |
| P-009 | In-app reminders only in Milestone 1, using the user's IANA timezone; add browser/email/push/calendar channels later by separate opt-in. | Avoids notification permissions and delivery infrastructure before the tracker workflow is proven. | Today is the authoritative reminder surface initially. |
| P-010 | Provision Cloudflare Email Routing/Worker + private R2 + Queue for Milestone 3, conditional on prototype and privacy review. | Gives WIP direct control over transient raw-object retention; convenient inbound providers currently document retaining received email. | Adds a separate worker deployment at M3, with explicit deletion and lifecycle tests. |
| P-011 | Delete WIP-controlled raw email after successful structured persistence, target within 24 hours, and apply a maximum seven-day failure/retry window plus provider lifecycle delay unless the user explicitly saves the original. | Balances retry reliability with a clear transient-content policy. | Vendor selection and UI disclosure must meet this retention behavior. |
| P-012 | Release a Hiring Pulse cell only with at least 30 distinct contributors, 100 eligible applications, and 30 metric-specific qualifying observations, plus complementary suppression. | Conservative initial protection against sparse-cell re-identification and unstable rates. | Small cohorts show “not enough data,” not a statistic. Review with privacy/statistical expertise before M4. |
| P-013 | The applications table is the default view; Kanban is a secondary equivalent view included by the end of Milestone 1. | Table exposes dates/actions and scales better; Kanban is valuable for stage-oriented users but cannot be the only interface. | Both use the same filters/query and status-change command. |
| P-014 | Seed data is deterministic, fictional, and available only to local/test/demo identities, never automatically inserted for production users. | Makes the first tracker demonstrable and testable without creating privacy or cleanup problems. | Seed fixtures cover key states and edge cases. |

## Open product questions

| ID | Question | Recommended default / decision deadline |
| --- | --- | --- |
| O-001 | What is the public name, domain, and visual identity? | Keep “WIP” as a development label. Decide before production auth URLs, forwarding domains, Chrome Web Store listing, or public beta. |
| O-002 | Which sign-in methods launch first? | Recommend email magic link plus Google if recent-graduate testing supports it. Approve before Milestone 1 auth implementation; consider extension flow at the same time. |
| O-003 | Does “exact snapshot” require pixel-perfect screenshot/PDF/full DOM in addition to semantic content? | Recommend P-001 only. Decide before snapshot schema and capture acceptance tests. |
| O-004 | Are the proposed stage names and Kanban terminal-column behavior right? | Recommend P-002 and collapsed terminal columns. Decide before Milestone 1 UI/reducer implementation. |
| O-005 | Is Kanban mandatory for the first internal demo or acceptable at the end of Milestone 1? | Recommend building detail/table/Today first, Kanban last within M1. Decide when defining the first demo date. |
| O-006 | What reminder time should be suggested when an action has a date but no time? | Recommend 9:00 a.m. in the user's timezone with explicit preview. Decide before Today/reminder implementation. |
| O-007 | Should a person be able to attach and store actual resume/cover-letter files in the first beta? | Recommend metadata-only P-008. Decide before beta invitation copy; do not add storage preemptively. |
| O-008 | What is the duplicate-application experience for the same employer/role? | Recommend warning on normalized company/role/source URL, always allow override, never database-enforce uniqueness. Validate during M1 user testing. |
| O-009 | How should extension authentication work and how long may its credential persist? | Recommend user-initiated web auth, session access token, revocable rotated refresh credential without cookies permission. Threat-model and decide at M2 start. |
| O-010 | Which pages/sites must the generic extension extractor support at M2 launch? | Recommend generic JSON-LD/semantic extraction plus a small fixture set, not contractual named-site coverage. Decide M2 test matrix after observing initial users. |
| O-011 | What is the definitive email provider, parser/model provider, and processing region? | Use P-010 only after retention, training, subprocessors, deletion, abuse handling, and cost review. Must be decided before any real forwarded email. |
| O-012 | Should attachments ever be processed, and should users be allowed to save original forwarded email? | Recommend ignore attachments and omit “save original” from the first M3 slice. Decide during M3 threat/privacy review. |
| O-013 | What counts as a first employer response? | Recommend exclude automated receipt confirmations and include first confirmed human/recruiting next-step/rejection/offer event. Finalize metric definition before M4 derivation. |
| O-014 | What counts as ghosting, from which event, and after what observation window? | Do not publish the label yet. Research 30/45/60-day windows, follow-up effects, censoring, and user expectation before M4. |
| O-015 | Which cohort dimensions are useful and safe (time period, role family, location, employer size, source)? | Start with broad time period and role family; exclude named employer/location until threshold/privacy testing. Decide before M4 consent text. |
| O-016 | What jurisdictions, minimum user age, backup retention, deletion recovery window, and legal terms apply to beta? | Start with a tightly scoped beta geography and no minors if feasible. Legal/privacy review required before public beta. |
| O-017 | What product analytics, error monitoring, and support access are acceptable? | Recommend content-free minimal telemetry, sanitized errors, and audited support access. Choose vendors/configuration before production traffic. |
| O-018 | Should archived applications and rejected automated proposals be recoverable after user deletion? | Recommend no application recovery window for internal alpha; if beta needs one, disclose and implement inaccessible soft-delete followed by automatic purge. Decide before deletion UI. |

## Metric definitions to resolve before Milestone 4

These are not yet confirmed product claims:

- **Response time:** likely `application.submitted.occurred_at` to first qualifying confirmed employer event; automated acknowledgements excluded.
- **Interview rate:** applications with at least one confirmed `screen.invited` or `interview.invited`, divided by submitted applications old enough to observe.
- **Rejection rate:** needs a denominator/window that handles still-open and unobserved outcomes; “all applications” may mislead.
- **Offer rate:** applications with confirmed `offer.received`, divided by submitted applications with a sufficient observation window.
- **Offer acceptance:** confirmed `offer.accepted` divided by observed offers, with the offer denominator independently thresholded.
- **Ghosting/no response:** requires a disclosed waiting window and censoring rule; absence of a recorded event is not proof that no employer response occurred.

Each published metric needs a versioned name, numerator, denominator, inclusion/exclusion rules, time window, cohort dimensions, suppression rule, and plain-language caveat.

## Immediate approvals requested

Milestone 1 can begin without reinterpreting the product once the owner approves or revises:

1. P-001 semantic snapshot definition;
2. P-002 stage vocabulary;
3. P-004 recommended web/database stack;
4. O-002 initial sign-in methods;
5. P-008 metadata-only document versions; and
6. P-013 Kanban timing within Milestone 1.

Milestone 3 and 4 proposals do not need approval to start Milestone 1, but they must remain provisional in code and infrastructure until their respective gates.
