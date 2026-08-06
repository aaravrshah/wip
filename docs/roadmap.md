# Wip roadmap

Status: active milestone sequence
Last updated: 2026-08-05

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

## Milestone 1B-2 — Authentication and tenant isolation

### Goal

Add production-shaped authentication, internal owner provisioning, and database-enforced read isolation without adding application mutations or changing the existing repository/UI contract.

### User-visible scope

- Intentional signed-out landing page.
- Clerk sign-in/sign-up with Google and passwordless email verification links.
- Account menu with account management and sign-out.
- Protected Today, Applications, and Application Detail data.
- A clear empty state for a new authenticated owner; no automatic demo-data copy.
- Preserve the explicit fictional demo and all existing responsive read behavior.

### Technical scope

- Use current `@clerk/nextjs` APIs and Next.js 16 `proxy.ts`; enforce auth next to every protected page/data resource.
- Request the configured short-lived Clerk custom JWT server-side and pass it through Neon's driver `authToken` option.
- Register Clerk's JWKS and fixed audience with Neon RLS; use the passwordless `authenticated@` runtime connection.
- Idempotently map verified Clerk `sub` to an internal owner UUID through a zero-argument function.
- Enable and force RLS on `owners` and all ten `owner_id` tables. Use a `NOBYPASSRLS` authenticated role with SELECT plus only the owner-provision function.
- Keep privileged migration and seed URLs out of normal web runtime and keep authenticated repositories request-local.
- Add offline policy/config/UI coverage and opt-in live two-user RLS tests.

### Acceptance criteria

1. Signed-out users see the public landing/auth routes and cannot render Today, application lists/details, or any future non-public API data.
2. Google and passwordless email-link sign-in are presented by Clerk after the documented dashboard configuration.
3. First verified access provisions exactly one internal owner for the Clerk subject; retries return the same UUID and the browser cannot supply either identifier.
4. New owners receive no applications and never see the fictional seed.
5. User A cannot read User B's rows even when User B's internal UUID or public application ID is known.
6. Missing, malformed, expired, wrong-signature, wrong-issuer, or wrong-audience JWTs fail closed at the authentication/Neon boundary.
7. All identity/owned tables have enabled and forced RLS; the runtime role cannot bypass RLS or write tracker tables.
8. The demo source still works only through explicit configuration and cannot silently activate in production.
9. Existing UI/domain tests remain green; formatting, lint, strict type-check, applicable integration tests, build, and responsive/accessibility QA pass when the required credentials are configured.

### Deliberately postponed

- All application, event, snapshot, document, contact, note, and next-action mutations.
- General `/api/v1` query/command routes, transactional writes, export, deletion, and deployment.
- Kanban until the end of Milestone 1.
- Chrome extension, email ingestion, Hiring Pulse, file content/uploads, billing, and external beta admission.

## Milestone 1B-3 — Authenticated application management and event-first mutations

### Goal

Make the authenticated tracker useful for core manual application management over Neon without expanding into the remaining end-of-Milestone-1 features.

### User-visible scope

- Create an application with company/role, canonical stage, source/location/workplace facts, requisition ID, optional applied date, optional next action, and optional pasted job description.
- Edit mutable application facts with stale-update protection.
- Append current/backdated manual stage events and see the deterministic derived stage without rewriting prior events.
- Add, edit, and remove private notes.
- Add, complete, reschedule, edit, and remove next actions; Today responds to open/completed/due changes.
- Permanently delete one application after typing its exact company or role.
- Preserve existing read-only document metadata and contacts; demo mode remains explicitly read-only.

### Technical scope

- Add strict shared Zod command schemas and stable `/api/v1` application, stage-event, note, and next-action routes.
- Keep route handlers thin over request-local query/command services; derive identity only from the verified Clerk session/JWT.
- Use Neon HTTP/Drizzle batch transactions for application + initial-event creation and event + projection updates.
- Preserve effective event time separately from server creation time; use owner-unique idempotency for creates/events and row versions for stale fact/note/action writes.
- Require exact same-origin unsafe requests, JSON where bodies are expected, bounded streamed bodies/fields, validated path IDs, and stable machine-readable errors.
- Add forward-only Drizzle migrations with narrow grants and owner-matching INSERT/UPDATE/DELETE RLS only for implemented mutable tables; events/snapshots remain insert-only and immutable.
- Keep `DATABASE_URL` and `DIRECT_DATABASE_URL` out of every real-user read/write path.

### Acceptance criteria

1. A new authenticated user can create an application with an optional immutable pasted snapshot, optional action, and exactly one confirmed `application.created` event in one atomic command.
2. Retrying the same create/event key does not duplicate records; reusing it with different input conflicts.
3. Fact edits create one meaningful audit event, no-op formatting does not create noise, and stale versions conflict instead of silently overwriting.
4. Manual/current/backdated stage events retain occurrence and creation time, stay immutable, allow realistic corrections, and deterministically update the projection in the same transaction.
5. Notes and actions support their scoped lifecycle; completed actions leave Today and rescheduled actions use the new due time.
6. The permanent-delete control requires exact company/role confirmation, deletes dependent rows, has no recovery UI, and discloses backup-retention limits.
7. `/api/v1` rejects unauthenticated, cross-origin, unsupported, oversized, malformed, and caller-forged ownership input with stable error semantics.
8. User A cannot read, edit, transition, note, schedule, or delete User B's application, even with known IDs; PostgreSQL RLS remains forced and the role remains `NOBYPASSRLS`.
9. The explicit fictional demo renders but rejects every mutation attempt.
10. Existing Today, table/mobile cards, detail, search/filter/sort, documents, contacts, and responsive/accessibility behavior remain intact.
11. Formatting, lint, strict type-check, unit/UI tests, applicable live migration/mutation/two-user RLS tests, production build, diff checks, and configured browser QA pass.

### Deliberately postponed

- Chrome extension and browser permissions until Milestone 2.
- Forwarded email/model calls until Milestone 3.
- Hiring Pulse until Milestone 4.
- Kanban, archive/restore, export/account deletion, additional snapshot capture/recapture, document/contact mutation, deployment, and external-beta operations until separately scoped Milestone 1 slices.
- External reminder channels, file content/uploads, imports, bulk editing, teams, native apps, job discovery, and auto-apply.

## Milestone 1C — Complete core manual tracker

Status: implemented 2026-08-05

### Goal

Finish the core Wip tracker experience without beginning capture, automated ingestion, analytics, uploads, or deployment.

### User-visible scope

- Switch Applications between the default responsive table/cards and a nine-column board over the same filtered applications.
- Move an application by drag-and-drop or a labeled selector, confirm backward/terminal transitions, and receive pending/success/error feedback with rollback.
- Create, associate, edit, and remove minimal application contact metadata.
- Create/edit logical resume, cover-letter, portfolio, or other metadata; append immutable versions and associate exact versions/purposes with an application.
- Download a versioned full-tracker JSON export or spreadsheet-safe applications CSV.
- Permanently delete all tracker data after an exact phrase while keeping the separate Clerk authentication account.
- Guide an empty authenticated owner directly to creating a first application, preserving form values after server validation errors.

### Technical scope

- Reuse the existing repository, validation, authenticated request factory, transactional stage command, and event projector.
- Add native board interactions without a drag-and-drop dependency; confine mobile horizontal scrolling to the board region.
- Add strict shared contact/document/deletion schemas and thin same-origin `/api/v1` routes over owner-scoped metadata/data services.
- Add forward-only migrations for contact/document taxonomies, optimistic versions, forced-RLS policies, least-privilege grants, and the zero-argument transactional deletion function.
- Keep events, snapshots, and document versions immutable and ensure caller input never contains authoritative ownership.
- Generate exports directly from owner-scoped reads without persisting an artifact.

### Acceptance criteria

1. Table stays default; switching to Board preserves search/stage/sort inputs and renders all canonical stages plus empty-column guidance.
2. Dragging or choosing a stage appends the same confirmed immutable event and updates the deterministic projection; failure restores the prior card column.
3. A fully labeled keyboard-accessible stage selector exists, and backward/terminal transitions require a cancelable confirmation surface.
4. At approximately 390×844, the page does not overflow horizontally; only the board scroller does.
5. Contacts and associations support create/link/edit/remove for the authenticated owner and reject cross-owner references through PostgreSQL RLS.
6. Logical documents support metadata edits and append-only versions/application uses; the runtime role cannot update or delete a document-version row.
7. JSON export contains every implemented tracker entity in the documented versioned envelope and no owner/auth credentials; CSV is owner-scoped and formula-neutralized.
8. Whole-tracker deletion requires `DELETE MY WIP DATA`, deletes only the authenticated owner's tracker rows transactionally, resets tracker settings, and does not delete the Clerk account.
9. New-user empty states lead to application creation; important mutations expose loading/success/error feedback and validation failures preserve entered values.
10. Unit/UI/route/schema tests pass, and disposable-branch integration coverage verifies event ordering, contact ownership, document immutability, export isolation, and deletion isolation when configured.
11. Formatting, lint, strict type-check, production build, migration drift, diff checks, and desktop/mobile browser QA pass to the extent local authentication configuration permits.

### Deliberately postponed

- Archive/restore and snapshot recapture.
- Chrome extension, email ingestion, Hiring Pulse, uploads/file content, billing, deployment, and real-user beta admission.
- Clerk-account deletion, asynchronous large-export storage, imports, bulk editing, external reminders, collaboration, native apps, job discovery, and auto-apply.

## Milestone 2A — First user-invoked Chrome capture

Status: implemented 2026-08-05

### Goal

Let a signed-in user intentionally capture the current job page into the tracker without granting persistent access to every site.

### User-visible scope

- Load the Manifest V3 extension locally and sign in through Clerk's standalone Native API flow.
- Click the extension action on a job page.
- Preview/edit detected company, role, location, canonical stage, optional metadata, exact URL, and job description.
- Explicitly save a new application with one immutable semantic snapshot, or open a conservatively detected existing application.
- Receive a useful manual-add fallback when extraction is incomplete or the page is restricted.

### Technical scope

- Add `apps/extension` using WXT and shared domain/schema/API packages.
- Use packaged code, user-invoked `activeTab`, `scripting`, `storage`, exact Wip API/Clerk Frontend API hosts, and Clerk's standalone Chrome Extension SDK/Native API flow. Do not use Sync Host because its current documented flow requires `cookies`.
- Implement standards-first extraction: complete `JobPosting` JSON-LD, focused ATS/semantic document regions, then a bounded signaled main-region heuristic. Test against committed fictional fixtures rather than live sites.
- Share the strict capture command/response schema. Keep the fetch client in the extension and the owner-derived transaction in the web command service.
- Sanitize and hash again on the server; all extension fields remain untrusted.
- Store an unfinished reviewed page only in `chrome.storage.session`; clear it after save/cancel.
- Return typed created/duplicate results, detect duplicates only with owner-scoped normalized URL or requisition-plus-company signals, and use an owner-scoped idempotency key for retries.

### Acceptance criteria

1. The built manifest requests only `activeTab`, `scripting`, and `storage`, plus exact configured Wip and Clerk hosts; it has no `<all_urls>`, broad content-script match, `tabs`, `identity`, history, cookies, network interception, downloads, or unlimited-storage permission.
2. Page access occurs only after a user gesture and only for the current tab. A permission snapshot test fails if scope broadens unexpectedly.
3. A fixture with valid `JobPosting` data and a generic semantic fixture both produce a preview with provenance and extraction warnings.
4. The user can edit core/optional metadata and must explicitly save before job content reaches the system of record; signed-out, loading, unsupported, saving, recoverable-error, duplicate, and success states are accessible.
5. Saving creates exactly one idempotent application/confirmed-extension-event/snapshot operation, including retry after a lost response.
6. The saved snapshot remains available after the source fixture/page is removed and includes capture time, URL, extractor version, plain text, sanitized HTML, and content hash.
7. Unsupported/restricted pages fail safely with a manual web-add path and no permission escalation.
8. A duplicate opens the existing application and never overwrites/attaches to its immutable history. Company/title similarity alone does not merge records.
9. The API requires a verified normal Clerk session token and exact extension-origin CORS; it derives/provisions the owner server-side and retains forced RLS. The extension never receives a database URL, secret, or custom Neon token.
10. Extension fixture/popup/manifest/storage tests, web route/sanitization tests, configured database transaction/RLS tests, production builds, ZIP generation, and built-artifact secret/permission scans pass when their required environments are available.

### Deliberately postponed

- Background detection of job pages, continuous browsing observation, and bulk scraping.
- Broad LinkedIn scraping or search-results harvesting.
- Form filling, auto-apply, or application submission.
- Applicant-tracking-system passwords or cookies.
- Automatic detection of application-confirmation pages unless separately scoped after the capture flow is proven.
- Attaching a new snapshot to an existing application, explicit create-anyway override, snapshot history UI, and named-site support promises.
- Stable production CRX identity, Chrome Web Store submission, deployment, Firefox/Safari publication, and external-beta operations.

## Milestone 2B — Capture hardening and beta preparation

### Goal

Use observed 2A failures to harden capture and duplicate workflows without broadening background access.

### Recommended scope

- Configure and test a stable development/production CRX ID and documented Clerk allowed origins.
- Decide the production extension-auth experience after reviewing Native API abuse/session storage and the `cookies` tradeoff for Sync Host; do not add a permission silently.
- Add an explicit user-confirmed action to append a new immutable snapshot to an existing duplicate, plus a deliberate create-anyway escape hatch where safe.
- Add snapshot history/version selection on Application Detail before supporting attachment.
- Add only a small number of isolated ATS adapters selected from real opt-in failure reports, backed by sanitized fictional regression fixtures.
- Perform controlled browser QA across accessible static/dynamic pages, CSP-heavy pages, iframed job views, and expired/revoked sessions.
- Reduce or deliberately accept the Clerk popup bundle size, finish stable icons/store metadata, and prepare—but do not publish—a store-review artifact.

### Acceptance criteria

1. Stable IDs keep Clerk and Wip origin allowlists deterministic across rebuilds.
2. Snapshot attachment is an explicit confirmed append and never rewrites an earlier snapshot or timeline.
3. Create-anyway cannot be triggered by a network retry and remains idempotent.
4. Every added adapter has fictional regression fixtures, bounded DOM scope, provenance, and a generic fallback.
5. Authentication expiry/revocation, CORS denial, duplicate races, and dynamic-page failures recover without data loss or broader permissions.
6. Store-readiness review confirms packaged-code-only MV3 behavior, narrow disclosure, accessibility, bundle size, and no secrets; publication remains separately authorized.

### Deliberately postponed

- Background monitoring, search-result harvesting, confirmation-page detection, broad host access, auto-apply/form filling, and employer credentials/cookies.
- Email ingestion, Hiring Pulse, file uploads, external reminders, billing, and native/mobile clients.

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
6. **Milestone 1B-2:** integrate Clerk, idempotent owner provisioning, least-privilege authenticated reads, and forced RLS; remain read-only.
7. **Milestone 1B-3:** add the versioned application/stage/note/action commands, optional pasted snapshot on create, stale/idempotent/atomic event behavior, narrow write RLS, and permanent single-application deletion.
8. **Milestone 1C:** add Kanban over the same stage command, contact/document-version metadata, direct JSON/CSV export, and whole-tracker deletion while retaining the Clerk account.
9. Complete separately scoped archive/restore, snapshot recapture, deployment readiness, vendor/legal review, and configured cross-user/end-to-end validation before beta.

Milestone 1A validates the screens and read model first. Milestone 1B-1 proves persistent read parity; 1B-2 adds authenticated read isolation; 1B-3 implements the core manual mutation vertical; 1C completes the scoped core tracker experience without claiming production or external-beta readiness.
