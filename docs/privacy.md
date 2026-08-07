# Wip privacy baseline

Status: product and engineering requirements; not a public legal policy  
Last updated: 2026-08-06

## 1. Privacy promise

Wip is a private job-search record first. A person must be able to use the tracker without contributing to aggregate hiring statistics, granting broad browser access, or connecting an email inbox. Automation is user-invoked or based on email the user intentionally forwards. Consequential automated status changes require confirmation.

This document defines product behavior and engineering constraints. Before a public beta, counsel should review the actual privacy notice, terms, subprocessors, retention schedule, and regional obligations.

## 2. Data Wip collects

Wip collects only what is needed for an enabled feature.

### Account and settings

- Clerk's immutable account subject plus sign-in identifier and authentication metadata managed by Clerk;
- timezone, locale, and minimal product preferences;
- consent records and policy version; and
- security/audit records necessary to protect the account.

### User-entered tracker data

- company, role, location label, source URL, and application stage;
- immutable job-description snapshots and capture metadata;
- chronological application events and their occurrence/source/confirmation metadata;
- resume, cover-letter, portfolio, and other document-version metadata;
- user-entered contacts, notes, and next actions; and
- optional reminder settings.

The manual tracker permits a user to paste employer-authored job-description text. The server converts it to normalized plain text plus escaped semantic HTML and stores provenance/hash metadata. It does not interpret that text as applicant profile data. Note and action inputs are private operational content; the UI explicitly warns against entering prohibited sensitive applicant data.

The MVP stores document-version metadata, not resume or cover-letter file contents. A later file-upload feature requires a new retention and security review.

### Extension capture data

Only after the user clicks Wip, the extension temporarily reads the active HTTP(S) tab's source/canonical URL, page title, focused job-description HTML/text, and defensible job metadata such as role, company, location/workplace, employment type, salary text, and requisition ID. It records the local extractor version, selected source, per-field confidence/source, and warnings. The popup shows the exact source URL and editable review; no job content is sent until the user chooses Save.

The extractor prefers `JobPosting` JSON-LD and focused job-description regions. It removes scripts, forms and form responses, event handlers, navigation, media/embeds, and unrelated page regions before review. It does not read employer cookies, authentication tokens, private messages, applicant-portal answers, other tabs, or browsing history. Server-side validation/sanitization is authoritative and the server computes the persisted content hash; browser input is never trusted as safe HTML.

An unfinished capture is kept only in `chrome.storage.session` so the popup can recover from closure or a failed request. Wip clears it after a successful save/attachment or explicit cancellation, and Chrome clears session storage when the browser exits. Expired or revoked authentication signs the extension session out and asks the user to sign in again without deleting the reviewed job. Wip code requests a fresh Clerk session token only for a confirmed save/attachment, sends it in the authorization header, and never writes or logs that token. Clerk's supported extension SDK manages its own authentication session; its exact internal at-rest/session behavior and Native API abuse controls must be reviewed before external beta.

A conservatively detected duplicate is not silently merged. The popup identifies the existing application and offers to open it unchanged or explicitly attach the reviewed posting. Attachment adds a new immutable snapshot and a confirmed provenance event to that owner-scoped application; it does not edit or replace prior snapshots.

### Forwarded recruiting email, later

When a user intentionally forwards an email to their Wip address, Wip may temporarily process sender/recipient metadata, subject, text/HTML body, headers required for threading/provenance, and attachments required for extraction. Structured outputs are limited to application matching, event type, occurrence time, source, confidence, and a minimal evidence excerpt if necessary for confirmation.

Raw forwarded-email content is transient. Wip deletes its raw copy immediately after a structured result is safely persisted, targeted within 24 hours of successful extraction. Failed processing may retain a private raw object for retries, with an automatic deletion backstop no later than seven days after receipt plus the storage provider's documented lifecycle-processing delay. A user may explicitly choose to save the original; that choice must explain the new retention behavior.

An inbound-email vendor cannot be launched unless its own retention and deletion controls are compatible with this disclosure. Vendor-held copies count as raw email; Wip cannot claim deletion while an uncontrolled provider copy remains accessible.

### Operational telemetry

Wip may collect minimal security and reliability data such as request time, route, coarse device/browser class, error code, deployment version, and randomized session identifier. Logs must not contain snapshot text, notes, contact details, document names, raw emails, access tokens, full source URLs with query strings, or event payloads. Product analytics, if added, needs a separate disclosure and must not imply consent to Hiring Pulse contribution.

### Authentication and PostgreSQL persistence boundary

Clerk is the web authentication provider selected in Milestone 1B-2. Initial methods are Google and passwordless email verification links. Clerk necessarily processes the account identifier, authentication factors/provider metadata, session/device/security information, and delivery events needed for those methods. Wip stores only Clerk's immutable subject on the internal owner record; it does not copy a Google access token into the tracker database or request additional Google scopes beyond authentication. Provider retention, subprocessors, regions, security controls, and account-deletion behavior require review before external beta.

Neon PostgreSQL is the operational system of record. The database receives only the tracker fields listed above plus the Clerk subject-to-internal-owner mapping; choosing Neon/Clerk does not expand tracker collection. Database connection strings and Clerk secret keys are server-only and must never be exposed to browser JavaScript, extension code, public environment variables, logs, fixtures, or screenshots. The Clerk publishable key is intentionally public but conveys no database privilege.

Milestone 1B-2 maps a verified Clerk subject to an internal UUID and enforces enabled/forced PostgreSQL RLS. Under C-046, Clerk verifies the web cookie or extension Bearer session token in Next.js. For extension capture, the server also requires the token's authorized party (`azp`) to equal the exact `chrome-extension://` request origin in the configured allowlist. It then opens one request-local transaction through the password-protected, SQL-created `wip_runtime` role, sets only the verified subject in transaction-local claims, provisions/derives the internal owner, performs the operation, and closes the pool. The role cannot bypass RLS or update/delete immutable events, snapshots, or document versions. Contact and document associations are protected by both same-owner foreign keys and owner policies. Privileged seed/migration URLs are never used for authenticated reads, writes, export, deletion, or extension capture. No database credential or claim context enters browser code. Missing, invalid, expired, revoked, or wrong-party Clerk authentication fails closed before database access; an authenticated owner cannot read or mutate the fictional seed or another owner's rows even if an internal UUID is guessed.

The product now supports manual authenticated tracker writes and user-confirmed extension capture/attachment but is not deployed or published by this milestone. The explicit fictional demo remains read-only. Database/auth integration tests must use a disposable branch and fictional test identities only. `docs/extension-private-beta.md` records the extension's narrow private-beta disclosure and draft store answers; it is not a substitute for a reviewed public privacy policy. Before external beta, document Neon backup/branch deletion behavior, Clerk deletion/session/Native API retention and abuse controls, production Google OAuth configuration, and both vendors' privacy/subprocessor terms.

## 3. Data Wip does not collect

Wip must not ask for, create fields for, infer, import, log, or store an applicant's:

- EEO questionnaire answers;
- race or ethnicity;
- gender or sexual orientation;
- disability or medical status;
- veteran status;
- Social Security number or other national identifier; or
- birthdate.

Wip also does not collect:

- passwords for employer or applicant-tracking systems;
- full browsing history;
- inbox-wide email access in the scoped roadmap;
- background page contents from tabs the user did not invoke Wip on;
- precise location from the device;
- contact enrichment purchased or scraped from third parties; or
- data for auto-applying, mass submitting, or scoring an applicant's employability.

Employer-authored equal-opportunity language may be incidentally present inside an exact job-description snapshot. It is source-page content, not an applicant attribute, and must never be parsed into a profile or analytics dimension. Free-text forms should warn users not to enter prohibited applicant data; detection/redaction can provide a safety net but cannot justify requesting it.

## 4. Purposes and boundaries

Operational user data is used to:

- display and organize the user's tracker;
- preserve source job-description evidence;
- calculate the user's current stage and next actions;
- generate user-requested reminders;
- extract proposed events from intentionally forwarded email; and
- support export, deletion, security, and troubleshooting.

Wip must not sell personal tracker data, use it for targeted advertising, expose it to employers, or train a generally available model on it without a new explicit opt-in agreement. Model-processing terms, retention, and training controls must be reviewed before Milestone 3.

## 5. Hiring Pulse contribution

### Opt-in consent

Aggregate contribution is off by default. The user must make a separate, affirmative choice after seeing:

- which event categories and coarse dimensions will contribute;
- which statistics may be produced;
- how identifiers and free text are removed;
- the minimum-cohort rules;
- how to withdraw; and
- the limitation that contributors are not representative of all applicants.

The choice cannot be bundled with account creation, tracking functionality, product analytics, marketing email, or a dark-pattern control. Consent is versioned. Material changes to contribution scope require renewed consent.

Only confirmed events can contribute. Notes, contacts, document names/content, raw emails, job-description text, direct identifiers, exact URLs, and rejected/pending suggestions never contribute.

### De-identification and release

Operational identifiers are removed before facts enter a restricted analytics schema. Exact timestamps are converted to durations or coarse calendar buckets. Rare dimensions are generalized or removed. Private contribution facts use an opaque key only so withdrawal/deletion can be honored; those facts are pseudonymous and are never exposed to clients.

Displayed statistics are released only when a cell contains:

- at least 30 distinct contributing users;
- at least 100 eligible applications; and
- at least 30 qualifying observations for the specific metric.

For conditional measures such as offer acceptance, the qualifying denominator must independently meet the threshold. Complementary suppression is required when other visible cells could reveal a suppressed cell by subtraction. Repeated or overlapping query combinations should be rate-limited or precomputed to reduce differencing attacks. These thresholds are proposed and require owner approval before Milestone 4.

### Statistical claims

Hiring Pulse describes activity among consenting Wip contributors within the displayed cohort and time window. It must not be described as:

- the true total applicant population;
- a representative sample of all applicants;
- a complete count of applicants for an employer or role;
- proof of employer intent or discrimination; or
- an individual prediction.

Every aggregate surface must display a plain-language caveat about opt-in selection bias, incomplete observation, and event-definition limits. Sample size and metric definition should be visible.

## 6. Access and permissions

- Users can access only their own tracker data. Database row-level security and application authorization both enforce this boundary.
- Clerk determines whether a request has a valid user session; it does not decide which tracker rows are visible. Next.js establishes the verified Clerk subject only for the request-local database transaction, and PostgreSQL policies authorize the mapped internal owner.
- New authenticated owners start empty. The twelve fictional demo records are never copied into a new account and have no Clerk identity mapping.
- Support access is deny-by-default, time-limited, audited, and used only with the user's authorization or for documented security/legal necessity.
- The extension uses temporary `activeTab` access after a user gesture, packaged `scripting`, session-only draft `storage`, and exact Wip API/Clerk Frontend API host patterns. Its stable development ID comes from a public manifest key; no private signing material is stored. It does not request `<all_urls>`, `tabs`, `identity`, cookies, browsing history, network interception, downloads, or persistent content-script matches.
- Email workers, extractors, and analytics jobs use separate credentials with access only to their required queue, storage prefix, schema, or endpoint.
- Raw email object storage is private, encrypted, not CDN-cached, and protected by explicit object deletion plus an expiry rule.

## 7. Retention

| Data | Baseline retention |
| --- | --- |
| Active tracker records and snapshots | Until the user deletes the application or all tracker data, subject to disclosed backups. |
| Rejected automated proposals | Retained with minimal provenance for audit until application/account deletion; user-facing delete controls may remove sooner. |
| Raw forwarded email after successful extraction | Delete immediately after safe structured persistence; target within 24 hours. |
| Raw forwarded email when processing fails | Private retry window, maximum seven days plus documented lifecycle-processing delay, then delete. |
| Explicitly saved original email | Retain like user content until the user deletes it; this is not the default. |
| Operational logs | Short, documented window; proposed 30 days unless security needs justify longer. No content payloads. |
| Private aggregate contribution facts | While current opt-in consent exists; delete on withdrawal/account deletion and recompute affected outputs. |
| Released aggregate rows | Recompute after withdrawal/deletion; previously viewed or exported totals cannot be recalled. |
| Backups | Provider-defined bounded schedule, documented before beta; deletion tombstones must be replayed after restore. |

Retention periods are product requirements, not permission to keep data merely because storage is inexpensive.

## 8. Export

Milestone 1C lets an authenticated user request a machine-readable export without contacting support. The versioned JSON baseline includes:

- applications and projection fields;
- job-description snapshot HTML/text and provenance;
- events and confirmation history;
- document-version metadata and application associations;
- contacts, notes, and next actions;
- settings; and
- consent history when that later feature exists.

JSON uses a documented `wip.tracker.export` envelope and format version. It omits internal owner IDs, Clerk subjects, tokens, and credentials. The optional applications CSV is a convenient projection rather than a lossless export and neutralizes cells that could otherwise be interpreted as spreadsheet formulas. Both are generated for the verified owner and streamed directly in the response; Wip does not create or retain a server-side export file in this milestone. Response caching is disabled. A future asynchronous large-export design would require private expiring storage and fresh authorization.

## 9. Deletion

Milestone 1B-3 implements permanent individual-application deletion from Application Detail. It requires typing the exact company or role, derives the owner from the verified session, returns not found for inaccessible IDs, and cascades through current database children. Milestone 1C additionally implements whole-tracker deletion after the user types `DELETE MY WIP DATA`. A zero-argument database function derives the internal owner from the transaction-local verified subject and deletes only that owner's applications, documents, contacts, and dependent records, then resets tracker preferences. It retains the minimal internal Clerk-subject mapping so the independently managed Clerk authentication account remains signed in and can show a clean empty tracker.

Neither deletion path has a recovery UI or soft-delete window. The Data & Privacy screen explicitly distinguishes tracker deletion from Clerk-account deletion. Clerk-account deletion remains unimplemented and must not be implied by deleting tracker data.

Deletion covers:

1. operational database rows and search/projection indexes;
2. snapshots and explicitly saved files/objects;
3. transient email objects and pending jobs where addressable;
4. private aggregate contribution facts linked through the restricted deletion map; and
5. refreshed aggregate outputs.

Future Clerk-account deletion also removes the auth identity after dependent data deletion is successfully scheduled. Backups may retain deleted bytes until Neon's configured/provider retention window expires; the exact production window is unresolved and must be disclosed before external beta. A restored backup must reapply deletion records before serving traffic.

## 10. Consent withdrawal

Withdrawing Hiring Pulse consent:

- does not delete or impair the user's private tracker;
- stops new contribution immediately;
- queues deletion of that user's private contribution facts;
- recomputes affected released cells or suppresses them if they fall below thresholds; and
- records the withdrawal and policy version without requiring a reason.

Withdrawal must be as easy to find and execute as opt-in. Wip should show completion state and communicate if aggregate recomputation is asynchronous.

## 11. Incident and vendor requirements

Before production use of Neon, any auth provider, hosting, email, model, analytics, error-tracking, or storage provider, record:

- data categories sent;
- processing region and subprocessors;
- encryption and access controls;
- retention and deletion behavior;
- whether customer data is used for model training or advertising;
- breach-notification terms; and
- an exit/export plan.

Security incidents involving raw email, snapshots, contacts, notes, or authentication tokens require containment, audit preservation without copying content unnecessarily, deletion review, and legally appropriate user notification. A vendor's default setting is not a privacy decision.

## 12. Decisions still required

- jurisdictions and beta geography;
- age floor and whether minors may use the product;
- exact backup and operational-log retention;
- raw-email vendor and verifiable deletion behavior;
- model provider and zero-retention/training controls;
- whether explicitly saved original email is needed at all;
- approved aggregate thresholds and allowable cohort dimensions; and
- whether future Clerk-account deletion should have a recovery window (application and tracker-data deletion have none).
