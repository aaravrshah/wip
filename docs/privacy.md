# Wip privacy baseline

Status: product and engineering requirements; not a public legal policy  
Last updated: 2026-08-04

## 1. Privacy promise

Wip is a private job-search record first. A person must be able to use the tracker without contributing to aggregate hiring statistics, granting broad browser access, or connecting an email inbox. Automation is user-invoked or based on email the user intentionally forwards. Consequential automated status changes require confirmation.

This document defines product behavior and engineering constraints. Before a public beta, counsel should review the actual privacy notice, terms, subprocessors, retention schedule, and regional obligations.

## 2. Data Wip collects

Wip collects only what is needed for an enabled feature.

### Account and settings

- sign-in identifier and authentication metadata managed by the auth provider;
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

The MVP stores document-version metadata, not resume or cover-letter file contents. A later file-upload feature requires a new retention and security review.

### Extension capture data

After the user invokes the extension, Wip may read the current tab's URL, title, and selected job-description content. The extension sends a previewed job-content snapshot and required metadata to Wip only when the user saves it. It does not collect general browsing history or run persistent collection across sites.

### Forwarded recruiting email, later

When a user intentionally forwards an email to their Wip address, Wip may temporarily process sender/recipient metadata, subject, text/HTML body, headers required for threading/provenance, and attachments required for extraction. Structured outputs are limited to application matching, event type, occurrence time, source, confidence, and a minimal evidence excerpt if necessary for confirmation.

Raw forwarded-email content is transient. Wip deletes its raw copy immediately after a structured result is safely persisted, targeted within 24 hours of successful extraction. Failed processing may retain a private raw object for retries, with an automatic deletion backstop no later than seven days after receipt plus the storage provider's documented lifecycle-processing delay. A user may explicitly choose to save the original; that choice must explain the new retention behavior.

An inbound-email vendor cannot be launched unless its own retention and deletion controls are compatible with this disclosure. Vendor-held copies count as raw email; Wip cannot claim deletion while an uncontrolled provider copy remains accessible.

### Operational telemetry

Wip may collect minimal security and reliability data such as request time, route, coarse device/browser class, error code, deployment version, and randomized session identifier. Logs must not contain snapshot text, notes, contact details, document names, raw emails, access tokens, full source URLs with query strings, or event payloads. Product analytics, if added, needs a separate disclosure and must not imply consent to Hiring Pulse contribution.

### PostgreSQL persistence boundary

Neon PostgreSQL is the operational system of record selected for Milestone 1B-1. The database receives only the tracker fields listed above; choosing Neon does not expand collection. Database connection strings are server-only secrets and must never be exposed to browser JavaScript, extension code, public environment variables, logs, fixtures, or screenshots.

Milestone 1B-1 contains fictional demo data only and scopes every read by an explicit internal owner identifier. This application-layer scope is a foundation, not a claim of production tenant isolation. Before real-user data, Milestone 1B-2 must add authenticated owner mapping, a least-privilege runtime database role, enforced PostgreSQL RLS, cross-owner security tests, and documented Neon backup/branch deletion behavior. Database integration tests must use a disposable branch or database containing fictional data only.

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
- Support access is deny-by-default, time-limited, audited, and used only with the user's authorization or for documented security/legal necessity.
- The extension uses temporary `activeTab` access after a user gesture and a narrow Wip API origin. It does not request `<all_urls>`, cookies, browsing history, or network interception.
- Email workers, extractors, and analytics jobs use separate credentials with access only to their required queue, storage prefix, schema, or endpoint.
- Raw email object storage is private, encrypted, not CDN-cached, and protected by explicit object deletion plus an expiry rule.

## 7. Retention

| Data | Baseline retention |
| --- | --- |
| Active tracker records and snapshots | Until the user deletes the application/account, subject to disclosed backups. |
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

Users can request a machine-readable export without contacting support. The baseline export includes:

- applications and projection fields;
- job-description snapshot HTML/text and provenance;
- events and confirmation history;
- document-version metadata and application associations;
- contacts, notes, and next actions;
- settings; and
- consent history.

JSON is the lossless baseline. CSV may be offered for applications, events, actions, and document uses. Exports are generated into short-lived private storage, require fresh authorization to download, and expire automatically. Export activity is audited without logging export contents.

## 9. Deletion

Users can delete an individual application or their account. The UI must explain scope and any recovery window before confirmation.

Deletion covers:

1. operational database rows and search/projection indexes;
2. snapshots and explicitly saved files/objects;
3. transient email objects and pending jobs where addressable;
4. private aggregate contribution facts linked through the restricted deletion map; and
5. refreshed aggregate outputs.

Account deletion also removes the auth identity after dependent data deletion is successfully scheduled. If a short recovery window is offered, data must be inaccessible during that window and hard deletion must occur automatically at its end. Backups age out on the disclosed provider schedule; restored backups must reapply deletion tombstones before serving traffic.

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
- whether any recovery window should follow application or account deletion.
