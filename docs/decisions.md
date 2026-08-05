# Wip decisions, assumptions, and open questions

Last updated: 2026-08-04

## How to use this log

- **Confirmed** means stated by the product owner or required by the Milestone 0 brief.
- **Proposed** means the recommended default used to make the specifications implementable, but owner approval is still required.
- **Open** means implementation must not silently choose an answer if the choice materially changes product behavior, privacy, permissions, or architecture.
- When a decision changes, append a dated replacement entry and mark the older entry superseded; do not erase the history.

## Confirmed decisions

| ID | Decision | Rationale / consequence |
| --- | --- | --- |
| C-001 | Superseded by C-013. “WIP” / “wip” was the initial working-name treatment. | Retained for decision history. |
| C-002 | The product will be a responsive web app plus a Chrome extension. | Web is the persistent tracker; extension supports browser capture. Native mobile apps are not in scope. |
| C-003 | Recent graduates and early-career applicants are the initial audience, while the model remains general. | Copy can welcome early-career users, but schema/status logic cannot depend on student-only fields or linear processes. |
| C-004 | The product preserves exact job-description snapshots and chronological application history. | Snapshots must be immutable; status must not overwrite source history. |
| C-005 | Users track application confirmations/status changes, document versions, reminders, and next actions. | These are core product concepts and must be first-class in the data model and detail experience. |
| C-006 | Forwarded recruiting email is a later feature. Extraction includes confidence and requires user approval for uncertain status updates. | Email ingestion is Milestone 3 and cannot silently mutate status. The proposed stricter initial rule requires confirmation for all automated status changes. |
| C-007 | Aggregate hiring statistics are optional and use de-identified, contributed events. | Hiring Pulse contribution is off by default and separate from ordinary product/analytics consent. |
| C-008 | Wip will not implement auto-apply, mass application submission, resume generation, native mobile apps, job discovery, or broad LinkedIn scraping in the scoped roadmap. | Product and permission scope must not drift into these areas. |
| C-009 | TypeScript is the default implementation language, with simple testable code, narrow permissions, and required lint/type/test gates. | Recorded in `AGENTS.md`; SQL/configuration remain appropriate exceptions. |
| C-010 | Wip must not store applicant EEO answers, disability status, veteran status, Social Security number, or birthdate. | Do not create fields, inference, logs, fixtures, or analytics dimensions for these data. Employer EEO boilerplate may be incidentally present only inside a job-post snapshot. |
| C-011 | Product/architecture documentation changes with product or architectural decisions. | Durable changes update the relevant spec and this log in the same change. |
| C-012 | Milestones are ordered: manual web tracker, Chrome capture, forwarded-email proposals, then Hiring Pulse aggregates. | Later infrastructure and permissions are deliberately deferred. |
| C-013 | The working product name is “Wip,” with that capitalization. It is not a legally cleared final name. | Use “Wip” in product copy and simple text wordmarks, but keep naming easy to replace and do not imply trademark clearance. |
| C-014 | An exact job snapshot initially means immutable sanitized semantic HTML, plain text, provenance, extractor version, capture time, source URL, and content hash. Screenshots and full-page archives are postponed. | Preserves useful evidence while excluding scripts, trackers, and unrelated page state. Milestone 1A may render fictional snapshot content but does not implement capture or persistence. |
| C-015 | Application stages are `saved`, `preparing`, `applied`, `assessment`, `interviewing`, `offer`, `accepted`, `rejected`, and `withdrawn`. Assessment includes online assessments, HireVues, coding tests, and take-home assignments. | The stage model now distinguishes asynchronous candidate work from live interviewing. Table filters, summaries, fixtures, and future projection logic use this vocabulary. |
| C-016 | Ghosting is a derived analytical outcome, not an application stage. | The tracker may show neutral “awaiting response” or stale heuristics; a future ghosting metric requires an observation-window definition and caveats. |
| C-017 | **Superseded by C-022.** The planned production stack was Next.js on Vercel with Supabase PostgreSQL, Auth, and RLS. | Preserved as the former architecture decision. The Next.js/Vercel portion remains current; the Supabase database and authentication choice does not. |
| C-018 | Documents remain metadata-only during the initial beta. | Track names, labels, filenames/hashes/references, and application associations without storing resume or cover-letter contents. |
| C-019 | The applications table is the default view. Kanban is postponed until the end of Milestone 1. | Milestone 1A implements the responsive table/cards only; Kanban belongs to a later Milestone 1 slice after the primary workflows are proven. |
| C-020 | **Superseded by C-023.** Initial authentication was planned as email magic links, with Google authentication postponed until before the external beta. | Authentication is now a separate decision for Milestone 1B-2; the product must not build against the former Supabase Auth assumption. |
| C-021 | Milestone 1A is a runnable front-end vertical prototype backed only by fictional in-repository seed data and a replaceable data-access boundary. | Authentication, persistent storage, extension work, email ingestion, and Hiring Pulse aggregation were explicitly excluded from 1A and remain later work. |
| C-022 | Use Neon PostgreSQL for the production database, Drizzle ORM for typed server-side queries, drizzle-kit for checked-in SQL migrations, and Neon's current serverless TypeScript driver in the Next.js runtime. Keep Next.js on Vercel. | Neon free-plan computes automatically suspend when idle and wake on a query without manual project restoration. Runtime requests use a pooled connection; migrations use a separate direct connection. Database credentials remain server-only. This supersedes the database portion of C-017 and P-004. |
| C-023 | **Superseded by C-025 through C-028.** Authentication was postponed to Milestone 1B-2 with Clerk as the leading candidate. | Preserved as the 1B-1 scope decision; the provider, methods, owner mapping, and authorization path are now confirmed. |
| C-024 | Milestone 1B-1 adds only the persistence foundation: normalized event-first tables, checked-in migrations, an idempotent fictional seed, a Neon-backed read repository, environment validation, and integration coverage. | Application mutations, RLS policies tied to authenticated identity, production auth, extension work, email ingestion, file storage, analytics, and deployment are deliberately postponed. The in-memory repository remains an explicit local/test fallback and may not activate silently in production. |
| C-025 | Use Clerk for web authentication with Google and passwordless email verification links as the initial methods. | Clerk's prebuilt Next.js UI supplies sign-in, sign-up, account management, and sign-out. Email verification remains required. Production Google OAuth credentials and provider/privacy review are still required before external beta. This resolves O-002 and supersedes C-020/C-023. |
| C-026 | Keep Wip's internal UUID `owners.id` separate from Clerk's immutable subject. Provision the mapping idempotently from a verified database JWT through a zero-argument database function; never accept the subject or owner UUID from browser input. | The `owners` row records `auth_provider = 'clerk'` and a uniquely constrained `auth_subject`. New authenticated owners start empty and never inherit fictional seed records. Provider identifiers do not spread through every product table. |
| C-027 | Use Clerk custom JWTs with Neon's supported JWKS/RLS integration. The Next.js server passes the JWT with Neon's HTTP driver to a passwordless `authenticated` role; PostgreSQL derives identity with `auth.user_id()`. | Neon verifies signature, issuer/expiry, and configured audience before queries. All 11 identity/owned tables enable and force RLS. The runtime role is `NOBYPASSRLS`, has read-only table grants, and can execute only the tightly scoped owner-provision function. No caller-set `request.jwt.claims` or pooled session variables are permitted. |
| C-028 | Milestone 1B-2 is the read-only authentication and tenant-isolation slice. It includes signed-out UX, authenticated owner provisioning, Neon RLS, and security coverage, but not application mutations or a general API layer. | The `ApplicationRepository` remains the UI boundary; authenticated requests cannot choose arbitrary owners. The explicit in-memory demo remains for local/test use and cannot silently activate in production. CRUD, commands, export/deletion implementation, Kanban, deployment, and later product systems move to 1B-3 or their existing milestones. |

## Proposed decisions requiring approval

| ID | Proposed decision | Why this default | Consequence if approved |
| --- | --- | --- | --- |
| P-001 | **Accepted and superseded by C-014.** Define an “exact snapshot” as immutable sanitized job-description HTML plus plain text, source/canonical URL, page title, capture time, extractor version, metadata, and content hash—not a screenshot or full-page archive. | Preserves the content the user needs while excluding scripts, trackers, cookies, unrelated page text, and brittle visual assets. | Milestone 1 paste and Milestone 2 capture target semantic fidelity; screenshots/WARC remain out of scope. |
| P-002 | **Accepted with `assessment` added; superseded by C-015 and C-016.** Use a small general stage vocabulary, keep archive separate, and treat no-response as a derived signal. | Avoids forcing every employer process into identical steps. | Table filters, summaries, and reducer tests use the confirmed C-015 vocabulary. |
| P-003 | Treat the launch MVP as Milestones 1 and 2, with Milestone 1 independently useful. | The full promise includes capture, but manual usefulness should not depend on extension approval/distribution. | Email and Hiring Pulse remain post-MVP. |
| P-004 | **Accepted by C-017, then superseded by C-022 and C-023.** Use pnpm + Turborepo, Next.js App Router on Vercel, and Supabase Postgres/Auth/RLS. | This was the lowest-integration-burden proposal at Milestone 0. | pnpm, Turborepo, Next.js, Vercel, and portable PostgreSQL remain; Neon and a separate auth provider replace Supabase. |
| P-005 | Use WXT for the MV3 extension with a popup, `activeTab`, `scripting`, `storage`, a narrow Wip API host, and likely `identity`; never request `<all_urls>` for the capture flow. | Good TypeScript extension workflow while preserving Chrome's temporary-access privacy model. | Extension authentication is threat-modeled at Milestone 2 start. |
| P-006 | Route all external mutations through versioned `/api/v1` command handlers, keep event/domain logic shared, and use RLS as defense in depth. | The extension and later workers need stable HTTP contracts; one write path keeps validation and audit consistent. | Direct browser database writes, if any, are limited to deliberately approved reads or narrow operations. |
| P-007 | Require user confirmation for every email-derived status-changing event in Milestone 3, regardless of confidence. | Safer and simpler than calibrating an auto-approval threshold before real-world extraction quality is known. | Confidence explains and sorts suggestions but never authorizes them. |
| P-008 | **Accepted; superseded by C-018.** Keep resume/cover-letter content out of the initial beta; store version metadata, filename/hash/reference, and exact application association only. | Satisfies “which version?” with substantially less sensitive content and storage risk. | File upload needs a later explicit security/privacy decision. |
| P-009 | In-app reminders only in Milestone 1, using the user's IANA timezone; add browser/email/push/calendar channels later by separate opt-in. | Avoids notification permissions and delivery infrastructure before the tracker workflow is proven. | Today is the authoritative reminder surface initially. |
| P-010 | Provision Cloudflare Email Routing/Worker + private R2 + Queue for Milestone 3, conditional on prototype and privacy review. | Gives Wip direct control over transient raw-object retention; convenient inbound providers currently document retaining received email. | Adds a separate worker deployment at M3, with explicit deletion and lifecycle tests. |
| P-011 | Delete Wip-controlled raw email after successful structured persistence, target within 24 hours, and apply a maximum seven-day failure/retry window plus provider lifecycle delay unless the user explicitly saves the original. | Balances retry reliability with a clear transient-content policy. | Vendor selection and UI disclosure must meet this retention behavior. |
| P-012 | Release a Hiring Pulse cell only with at least 30 distinct contributors, 100 eligible applications, and 30 metric-specific qualifying observations, plus complementary suppression. | Conservative initial protection against sparse-cell re-identification and unstable rates. | Small cohorts show “not enough data,” not a statistic. Review with privacy/statistical expertise before M4. |
| P-013 | **Accepted and clarified by C-019.** The applications table is the default view; Kanban is postponed until the end of Milestone 1. | Table exposes dates/actions and scales better; Kanban is valuable for stage-oriented users but cannot be the only interface. | Milestone 1A implements table/cards only; a later Milestone 1 slice adds Kanban over the same query and commands. |
| P-014 | Seed data is deterministic, fictional, and available only to local/test/demo identities, never automatically inserted for production users. | Makes the first tracker demonstrable and testable without creating privacy or cleanup problems. | Seed fixtures cover key states and edge cases. |

## Open product questions

| ID | Question | Recommended default / decision deadline |
| --- | --- | --- |
| O-001 | What is the legally cleared final name, domain, and visual identity? | Partially resolved by C-013: use “Wip” as the working name and simple text wordmark. Legal clearance/domain/final identity remain open before public beta. |
| O-002 | Which authentication provider and sign-in methods launch first? | Resolved by C-025 for the web app: Clerk with Google and passwordless email links. Extension token exchange remains O-009. |
| O-003 | Does “exact snapshot” require pixel-perfect screenshot/PDF/full DOM in addition to semantic content? | Resolved for the initial product by C-014: no; screenshots/full-page archives are postponed. |
| O-004 | Are the proposed stage names and Kanban terminal-column behavior right? | Stage vocabulary resolved by C-015. Detailed future Kanban terminal-column behavior remains open until the end-of-Milestone-1 Kanban slice. |
| O-005 | Is Kanban mandatory for the first internal demo or acceptable at the end of Milestone 1? | Resolved by C-019: postpone it until the end of Milestone 1; it is excluded from Milestone 1A. |
| O-006 | What reminder time should be suggested when an action has a date but no time? | Recommend 9:00 a.m. in the user's timezone with explicit preview. Decide before Today/reminder implementation. |
| O-007 | Should a person be able to attach and store actual resume/cover-letter files in the first beta? | Resolved by C-018: no; metadata-only during the initial beta. |
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

## Current implementation authorization

Milestone 1B-2 is authorized by C-025 through C-028 with these limits:

1. preserve the read-only Milestone 1A UI and repository contract;
2. add Clerk authentication, signed-out/authentication/account UX, and verified-session checks at each protected data boundary;
3. provision internal owners only from Neon-verified Clerk JWT context;
4. enable and force RLS for every identity/owner-scoped table, grant the runtime role read-only access plus the narrow provisioning function, and test fail-closed/cross-user behavior;
5. keep fictional demo/seed data isolated from authenticated owners; and
6. exclude application mutations, general `/api/v1` commands, Kanban, extension work, email ingestion, Hiring Pulse, file uploads, billing, deployment, and real-user beta admission.

Milestone 1B-3 and Milestones 2–4 remain outside the current implementation authorization.
