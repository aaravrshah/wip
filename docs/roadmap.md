# Wip roadmap

Status: active milestone sequence
Last updated: 2026-08-04

## Delivery rules across milestones

- Each milestone must be useful or testable on its own and must not depend on unbuilt later automation.
- A feature is accepted only when linting, type-checking, relevant tests, responsive/keyboard checks, documentation, and privacy/security acceptance criteria pass.
- Seed and fixture data must be fictional.
- Later-milestone interfaces may be reserved in the design, but infrastructure and permissions are not added until needed.
- Any change to scope, architecture, data meaning, permissions, or privacy behavior is recorded in `docs/decisions.md` and the relevant specification.

## Milestone 0 — Product and architecture baseline

### Goal

Create an implementable, privacy-aware product baseline without building the production application.

### Acceptance criteria

- Repository guidance establishes TypeScript, quality gates, narrow permissions, prohibited data, and user-confirmed automation.
- Product scope, UI surfaces, data model, privacy model, architecture, roadmap, and decisions are documented and cross-consistent.
- MVP and later features are separated, and explicit non-goals are recorded.
- Architecture options are compared using current official documentation.
- Assumptions requiring owner approval are clearly listed.

### Deliberately postponed

All application scaffolding, production services, UI implementation, extension code, email ingestion, analytics jobs, and vendor provisioning.

## Milestone 1A — Front-end vertical prototype

### Goal

Deliver a runnable, responsive Next.js prototype that validates Wip's primary information architecture and visual direction using only deterministic fictional seed data.

### User-visible scope

- Today dashboard with upcoming interviews/assessments, overdue follow-ups, applications awaiting responses, recently changed applications, and a compact stage summary.
- Applications list with a desktop table, mobile cards, search, stage filtering, and basic sorting.
- Application detail with company/role facts, source URL, requisition ID, complete chronological timeline, semantic job snapshot, resume and cover-letter metadata, contacts, notes, and next action.
- “Wip” text wordmark and a calm, optimistic consumer visual direction for students and early-career applicants.

### Technical scope

- Scaffold the pnpm/Turborepo workspace, `apps/web`, and only the shared domain package that already provides clear value.
- Use strict TypeScript and the Next.js App Router.
- Keep deterministic fictional seed data behind a small read-only repository/data-source interface that can later be implemented by a persistent adapter.
- Implement pure, tested calculations for stage counts, upcoming scheduled events, overdue follow-ups, awaiting-response heuristics, recent changes, filtering, and sorting.
- Add focused component/interaction tests and a production build check.
- Add concise README setup and run instructions.

### Acceptance criteria

1. Approximately 12 fictional applications cover every confirmed stage: `saved`, `preparing`, `applied`, `assessment`, `interviewing`, `offer`, `accepted`, `rejected`, and `withdrawn`.
2. No seed fixture contains real personal information, prohibited applicant data, real recruiting email, or access credentials.
3. Today renders each required section from domain calculations rather than hard-coded summary totals.
4. Applications supports keyboard-accessible search, stage filter, and sort controls; table rows/cards link to detail routes.
5. Desktop uses a readable table, while narrow screens use cards without horizontal scrolling.
6. Detail renders the complete oldest-to-newest timeline and all requested snapshot, document metadata, contact, note, and next-action information.
7. Components do not import seed arrays directly; they read through the data boundary.
8. Responsive layouts, semantic landmarks, focus states, color contrast, reduced motion, and form labels pass browser review.
9. Formatting, lint, strict type-check, relevant tests, and a production build pass.
10. No database, authentication, extension, email, persistent storage, Hiring Pulse, or Kanban implementation is present.

### Deliberately postponed

- All backend integration and Milestone 1B work.
- Neon PostgreSQL, authentication, RLS, `/api/v1`, persistence, and production data isolation.
- Create/edit/delete commands, export, and deletion workflows.
- Kanban until the end of Milestone 1.
- Google authentication until before the external beta.
- Chrome extension, forwarded email, and Hiring Pulse.

## Milestone 1B-1 — Neon persistence foundation

### Goal

Translate the event-first model into a deployable PostgreSQL foundation and prove read parity with Milestone 1A without admitting real users or adding mutations.

### User-visible scope

- Preserve Today, Applications, and Application Detail behavior.
- Permit an explicitly configured local instance to read the same twelve fictional applications from Neon.
- Preserve the in-memory demo repository for tests and deliberate local demos.

### Technical scope

- Add `packages/database` with Drizzle schema, drizzle-kit configuration, checked-in SQL migrations, a Neon HTTP runtime client, and an idempotent database seed.
- Model owners, applications, immutable events and semantic snapshots, document/version metadata and uses, contacts and links, notes, and next actions as normalized PostgreSQL tables.
- Put non-null `owner_id` on every user-owned relation, enforce same-owner references with composite keys, and make every repository read owner-scoped.
- Use a pooled `DATABASE_URL` for Next.js reads and a direct `DIRECT_DATABASE_URL` for migrations. Keep both server-only.
- Implement a Neon adapter behind the existing `ApplicationRepository`; do not import Drizzle into UI components.
- Add integration tests for applying migrations, repeatable seeding, repository reads, chronological event order, and owner isolation.

### Acceptance criteria

1. A clean database can be created entirely from the checked-in SQL migrations; no automatic schema push is required.
2. Running the fictional seed twice creates the same twelve applications and no duplicate child records.
3. Neon-backed Today, Applications, and detail reads produce the same domain shape and behavior as the in-memory source.
4. Events are returned oldest-to-newest even when inserted out of order.
5. Supplying one owner ID cannot return or link rows owned by another owner in repository queries or schema constraints.
6. Snapshots and event facts are protected from in-place update by database rules; corrections remain append-oriented.
7. Missing Neon variables prevent Neon selection with a clear server-side error. Production does not silently activate demo data.
8. Database URLs cannot enter client bundles and use separate pooled runtime and direct migration variables.
9. Formatting, lint, strict type-check, unit/UI tests, production build, and non-database checks pass. Live integration results are reported only when a configured disposable Neon test database is available.

### Deliberately postponed

- Authentication, sessions, provider webhooks, user onboarding, and auth-derived owner context.
- RLS policies and a least-privilege runtime role tied to authenticated identity; these are required in 1B-2 before real-user data.
- All application, event, snapshot, document, contact, note, and action mutations.
- `/api/v1`, transactional command handling, export, deletion, and production deployment.
- Kanban, extension, email ingestion, Hiring Pulse, and file upload/content storage.

## Milestone 1B-2 — Authenticated manual tracker completion

### Goal

Replace the fictional adapter with the production web system of record and complete the manually managed tracker without rewriting the Milestone 1A screens.

### User-visible scope

- Sign in and sign out using the provider and methods confirmed at the start of 1B-2. Clerk is the leading candidate, not yet a final decision.
- Create, edit, archive, restore, and delete applications.
- Paste and save immutable job-description snapshots.
- Add backdated or current manual timeline events and see the derived current stage.
- Record document-version metadata and mark exact versions as prepared/submitted.
- Manage contacts, notes, and next actions.
- Use Today, applications table, and application detail on desktop and mobile; add Kanban at the end of Milestone 1B-2.
- Complete/reschedule actions and see in-app due/overdue states in the user's timezone.
- Export personal data in a lossless JSON baseline.

### Technical scope

- Build on the pnpm/Turborepo TypeScript monorepo and `apps/web` established in Milestone 1A.
- Integrate the selected auth provider with the existing Neon PostgreSQL/Drizzle foundation, auth-derived owner context, least-privilege database access, RLS, typed validation, and `/api/v1` command/query routes.
- Implement shared event taxonomy, stage projector, confirmation policy, and Today calculations as tested pure domain code.
- Add deterministic fictional seed data that covers active, overdue, interviewing, offer, rejected, archived, multiple-snapshot, and multiple-document-version states.
- Establish CI for lint, strict type-check, unit/integration tests, database/RLS tests, and a small Playwright critical path.
- Add sanitized structured logging and environment validation.

### Acceptance criteria

1. A new authenticated user can create an application with company and role, optionally paste a job description, and receive a confirmed `application.created` event.
2. Saving a second job description inserts a second immutable snapshot; the first remains byte-for-byte unchanged and can still be viewed.
3. Manual events can be backdated, are ordered by occurrence time, retain creation time, and deterministically update the stage projection.
4. A correction is auditable and does not destructively rewrite the original event.
5. The Today screen correctly separates overdue, due-today, next-seven-days, needs-attention, and recent activity using the configured timezone.
6. The table supports the specified search, filters, sorting, URL state, and responsive card layout.
7. Kanban displays the same records and filters as the table. Dragging or keyboard/menu movement creates a manual confirmed event; terminal or unusual backward transitions ask for confirmation.
8. Application detail shows header, next action, timeline, snapshot versions, document uses, contacts, and notes in the specified responsive order.
9. Document use points to an immutable document version; editing a logical document does not change past associations.
10. User A cannot read, mutate, link, export, or delete User B's data through the UI, API, or direct exposed database API. Automated RLS tests prove this.
11. Per-application deletion removes owned children. Account export is complete for implemented entities. Account deletion behavior is implemented before any real-user beta, even if the first internal demo uses a controlled account.
12. Seed data is available only in local/test/demo environments and contains no real personal data.
13. Keyboard navigation, visible focus, form labels/errors, reduced-motion behavior, and narrow-screen layouts pass an accessibility/responsive review.
14. `pnpm lint`, `pnpm typecheck`, relevant tests, and the Milestone 1 Playwright critical path pass in CI.

### Deliberately postponed

- Chrome extension and any browser permissions.
- Automatic job-page extraction or broad site adapters.
- Forwarded email, inbox connections, and model calls.
- Pending automated event proposals beyond a static/dev fixture used to reserve UI space.
- Hiring Pulse contribution, cohort dimensions, or public statistics.
- Email, push, browser, SMS, or calendar reminders; Milestone 1 is in-app only.
- Resume/cover-letter file uploads or content parsing; metadata only.
- Imports, bulk edits, teams, native mobile apps, job discovery, and auto-apply.

## Milestone 2 — Current-job Chrome capture

### Goal

Let a signed-in user intentionally capture the current job page into the tracker without granting persistent access to every site.

### User-visible scope

- Install the Manifest V3 extension and connect it to the Wip account.
- Click the extension action on a job page.
- Preview/edit detected company, role, location, URL, and job description.
- Create a new application or add a new immutable snapshot to an existing application.
- Receive a useful manual fallback when extraction is incomplete or the page is restricted.

### Technical scope

- Add `apps/extension` using WXT and shared domain/schema/API packages.
- Use packaged code, MV3 service worker behavior, user-invoked `activeTab`, `scripting`, `storage`, a narrow Wip API host permission, and the approved auth flow.
- Implement standards-first extraction: `JobPosting` JSON-LD, semantic document regions, then bounded generic heuristics. Isolate any site adapters and test them against committed synthetic fixtures.
- Sanitize and validate in both extension and server; the server remains authoritative.
- Store page content only transiently in the extension and clear it after save/cancel.

### Acceptance criteria

1. The published manifest requests no `<all_urls>`, broad content-script match, history, cookies, network interception, downloads, or unlimited-storage permission.
2. Page access occurs only after a user gesture and only for the current tab. A permission snapshot test fails if scope broadens unexpectedly.
3. A fixture with valid `JobPosting` data and a generic semantic fixture both produce a preview with provenance and extraction warnings.
4. The user can edit every captured field and must explicitly save before anything reaches the system of record.
5. Saving creates exactly one idempotent application/snapshot operation, including retry after a lost response.
6. The saved snapshot remains available after the source fixture/page is removed and includes capture time, URL, extractor version, plain text, sanitized HTML, and content hash.
7. Unsupported/restricted pages fail safely with a manual paste/select path and no permission escalation.
8. Authentication tokens are scoped, revocable, never injected into the page, and not logged. The final storage/refresh design has a documented threat model.
9. Extension unit/integration tests, controlled browser tests, lint, and type-check pass in CI.

### Deliberately postponed

- Background detection of job pages, continuous browsing observation, and bulk scraping.
- Broad LinkedIn scraping or search-results harvesting.
- Form filling, auto-apply, or application submission.
- Applicant-tracking-system passwords or cookies.
- Automatic detection of application-confirmation pages unless separately scoped after the capture flow is proven.
- Firefox/Safari publication, even though shared code should avoid needless Chrome coupling.

## Milestone 3 — Forwarded-email ingestion with confirmation

### Goal

Turn intentionally forwarded recruiting emails into transparent, confidence-scored event proposals that the user confirms or rejects.

### User-visible scope

- Create/rotate a private forwarding alias and see forwarding instructions.
- See whether a forwarded message is received, processed, unmatched, or needs attention.
- Review proposed application match, event type, occurrence time, minimal supporting evidence, source, and confidence.
- Confirm, reject, correct, or rematch a proposal.
- See a confirmed proposal enter the canonical timeline only after approval.

### Technical scope

- Add the isolated inbound-email deployable and durable processing queue.
- Verify recipient alias, message limits, provider authenticity, idempotency, and replay/out-of-order behavior.
- Keep raw email in private transient storage; delete on successful structured persistence with a seven-day automatic expiry backstop for failures.
- Use an approved extraction provider/configuration with documented retention/training controls and versioned schemas/prompts.
- Persist structured extraction metadata and pending `application_events`; never raw bodies in PostgreSQL.
- Add observability that records state/error classes without content.

### Acceptance criteria

1. A valid forwarded application confirmation, interview invitation, rejection, and offer fixture each produce the expected structured candidate and confidence without altering current stage.
2. Every email-derived status-changing event starts `pending` regardless of confidence. Only a user confirmation changes stage and aggregate eligibility.
3. Rejection leaves an auditable decision but does not enter the confirmed timeline or projection.
4. Duplicate and out-of-order deliveries do not duplicate events or corrupt chronology.
5. Unmatched and ambiguous messages are shown to the user without silently creating a new application or choosing a weak match.
6. Raw content is deleted after successful extraction persistence; tests verify explicit deletion and lifecycle configuration. Failed content expires within the disclosed retry window.
7. Provider-held retention/deletion, model training/retention, encryption, and subprocessors meet `docs/privacy.md` and are documented before launch.
8. Rotating an alias invalidates the old alias after a short disclosed grace period and does not expose the user's email address in the alias.
9. Malicious HTML, attachments, prompt injection, oversized messages, and alias abuse fail safely.
10. End-to-end fixtures prove that confidence is displayed, provenance is preserved, and no uncertain automated status is silently applied.

### Deliberately postponed

- Direct Gmail, Outlook, or inbox-wide OAuth access.
- Automatic approval based on a confidence threshold.
- Storing raw email by default or creating a searchable email archive.
- Attachment processing beyond the minimum explicitly approved cases.
- Sending recruiter email, suggested replies, or autonomous follow-ups.
- Using user email to train a general model.

## Milestone 4 — Opt-in Hiring Pulse aggregates

### Goal

Show privacy-protected aggregate hiring timelines and rates from explicitly consenting Wip contributors, with transparent definitions and limitations.

### Initial measures

- time from confirmed submission to first qualifying employer response;
- interview-invite rate;
- observed rejection rate;
- offer rate;
- offer-acceptance rate among observed offers; and
- ghosting/no-response only if an observation-window definition is approved.

### User-visible scope

- Separate opt-in consent with a preview of contribution scope.
- Consent status and one-step withdrawal in settings.
- Hiring Pulse views with metric definition, time window, sample size, cohort description, suppression state, and selection-bias caveat.
- No individual prediction or employer/applicant leaderboard.

### Technical scope

- Add a versioned consent ledger, eligibility projector, isolated private facts, deletion map, thresholded public aggregates, and scheduled recomputation.
- Remove identifiers/free text/exact timestamps before private facts are written.
- Enforce minimum 30 contributors, 100 applications, and 30 metric-specific observations per displayed cell, plus complementary suppression, unless the thresholds are revised by an explicit decision.
- Version metric definitions and derivation code so historical changes are auditable.

### Acceptance criteria

1. No contribution occurs before an affirmative current consent record; tracker use remains fully functional when declined.
2. Only confirmed eligible events contribute. Pending/rejected suggestions, notes, contacts, documents, snapshots, and raw email cannot enter private facts.
3. Private facts contain no user/application ID, name, email, company, role title, URL, exact timestamp, free text, IP, or document/contact metadata.
4. Client credentials and APIs cannot access private facts or the deletion map.
5. Cells below any threshold are suppressed, and complementary/differencing tests prevent trivial recovery of a small cell.
6. Consent withdrawal stops new contribution, removes linked private facts, refreshes impacted aggregates, and does not delete the private tracker.
7. Account/application deletion follows the same removal and recomputation path.
8. Every aggregate display states that it reflects consenting Wip contributors rather than the true total applicant population and shows the metric definition/denominator.
9. Statistical, privacy, security, and accessibility reviews are completed before public release.

### Deliberately postponed

- Public row-level datasets or unrestricted analytics API.
- Individual success predictions, applicant scoring, or recommendations derived from protected/sensitive traits.
- Employer rankings, “best/worst” lists, or claims of discrimination based on self-selected product data.
- Highly granular employer/role/location slices that would create re-identification risk.
- A dedicated warehouse until volume or isolation requirements justify it.
- Monetization or sale of aggregate data.

## Suggested sequencing within Milestone 1

1. **Milestone 1A:** scaffold the workspace and quality tooling.
2. Add the shared domain types/calculations and deterministic fictional repository.
3. Build Today, Applications table/cards, and Application Detail.
4. Complete responsive/accessibility, interaction tests, browser QA, and production build validation; stop at the 1A boundary.
5. **Milestone 1B-1:** add Neon/Drizzle schema, checked-in migrations, fictional idempotent seed, read repository, and database integration tests.
6. **Milestone 1B-2:** select/integrate authentication, establish least-privilege runtime access and RLS, then add `/api/v1` application commands.
7. Add creation/editing, immutable persisted snapshots/events/actions, export, and deletion foundations.
8. Add Kanban over the same query/commands at the end of Milestone 1.
9. Complete cross-user, security/privacy, and end-to-end validation before beta.

Milestone 1A validates the screens and read model first. Milestone 1B-1 proves persistent read parity; 1B-2 then adds authenticated production behavior without changing every component.
