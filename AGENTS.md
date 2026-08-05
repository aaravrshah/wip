# WIP repository guidance

This file applies to the entire repository. More-specific `AGENTS.md` files may add constraints for a subtree, but they may not weaken the privacy, confirmation, permission, or quality requirements below.

## Product context

WIP is a user-controlled job-application tracker. The responsive web app is the system of record. The Chrome extension is a capture client, not a second database. Later email ingestion may propose timeline events, and later aggregate analytics may use only explicitly consented, de-identified contributions.

Read the relevant files in `docs/` before changing product behavior or architecture. Keep scope aligned with the current milestone; do not implement later-milestone infrastructure speculatively.

## Engineering defaults

- Use TypeScript by default for application, extension, worker, package, script, and test code. Keep `strict` type checking enabled. SQL migrations, declarative configuration, and browser manifests are expected exceptions.
- Prefer small modules, explicit data flow, pure domain functions, and dependency injection at external boundaries. Avoid abstractions until they remove demonstrated duplication or isolate a real boundary.
- Keep commands and APIs narrow. Validate all untrusted input at the boundary and return typed errors.
- Use the minimum database, browser, storage, network, and deployment permissions required for the current feature. Do not add broad host permissions such as `<all_urls>` when `activeTab`, a single application origin, or an optional permission will work.
- Treat PostgreSQL as the system of record. Keep job-description snapshots immutable and application history event-first. Correct history by appending or superseding records rather than rewriting what happened.
- Do not place service-role credentials, email-provider secrets, or model-provider secrets in browser or extension bundles.

## Required quality checks

Code work is not complete until all of the following pass for every affected workspace:

1. linting;
2. TypeScript type-checking without ignored errors;
3. relevant unit and integration tests; and
4. relevant end-to-end tests for changed user-critical flows.

Use repository-level commands once they exist (expected names: `pnpm lint`, `pnpm typecheck`, and `pnpm test`). Add or update tests for event projection, authorization boundaries, confirmation behavior, deletion/consent behavior, and extension permissions whenever those areas change. Never make a check pass by weakening the check, skipping a meaningful test, or adding an unexplained suppression.

For documentation-only changes before tooling exists, run the available Markdown/link checks and `git diff --check`, and manually verify cross-document consistency.

## Documentation and decisions

- Update the relevant files in `docs/` in the same change whenever product scope, data meaning, privacy behavior, permissions, architecture, or milestone acceptance criteria change.
- Record durable decisions and newly introduced assumptions in `docs/decisions.md`, including the date, status, rationale, and consequences.
- A schema migration that changes product meaning must update `docs/data-model.md`. A new data flow or external service must update `docs/architecture.md` and `docs/privacy.md`.
- Do not silently turn an unresolved question into an architectural commitment.

## Privacy and sensitive data

- Never ask for, model fields for, infer, import, log, or store an applicant's EEO responses, disability status, veteran status, Social Security number, or birthdate.
- Free-text inputs, imports, extension extraction, and email extraction must not intentionally identify or derive those attributes. If detected in user-provided content, reject or redact it where feasible and do not use it for analytics.
- Employer-authored equal-opportunity boilerplate that is incidentally part of an immutable job-description snapshot is job-posting content, not an applicant attribute. Do not extract it into profile fields or analytics dimensions.
- Collect only data needed for an active product capability. Keep raw forwarded-email content transient and delete it after structured extraction unless the user explicitly chooses to save the original.
- Aggregate contribution is off by default, separately consented, revocable, and subject to cohort suppression. Product analytics consent does not imply hiring-data contribution consent.
- Logs, traces, fixtures, screenshots, and seeded data must not contain real applicant data, raw recruiting email, access tokens, or sensitive personal information.

## Automated changes and user control

- Never silently apply an uncertain automated status change.
- Email-, model-, parser-, or heuristic-derived status-changing events must be presented as proposals with provenance and confidence. They affect the canonical timeline and current-stage projection only after user confirmation.
- In the initial email-ingestion milestone, require confirmation for every automated status-changing event regardless of confidence. A later relaxation requires an explicit product decision and documentation update.
- Rejection of a proposal is an auditable decision and must not be treated as a confirmed application event.
- Manual changes should create confirmed events so the chronological history remains explainable.

## Security and deletion

- Enforce ownership in the database with row-level security as well as in application code. Test cross-user isolation.
- Make webhook handlers signature-verified, idempotent, replay-safe, and tolerant of out-of-order delivery.
- Keep raw email and other transient artifacts in private storage with an automatic expiry backstop. Queue messages should contain opaque references, not raw message bodies.
- Deletion must cover operational records, transient objects, derived private contribution facts, and future recomputation of released aggregates as described in `docs/privacy.md`.
- Do not introduce destructive migrations without a documented migration, backup, and rollback plan.

## Accessibility and UX

- Build responsive, keyboard-accessible experiences using semantic HTML. Do not make Kanban drag-and-drop the only way to change status.
- Show timestamps in the user's timezone while storing them in UTC.
- Explain why a permission, consent choice, or automated suggestion is requested at the moment it is requested.
