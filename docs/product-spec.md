# Wip product specification

Status: Milestone 0 baseline  
Last updated: 2026-08-04  
Working name: Wip (not a legally cleared final name)

## 1. Product definition

### Target user

The initial user is a recent graduate or early-career applicant managing enough concurrent applications that spreadsheets, inbox search, and memory are no longer reliable. They often reuse and revise resumes and cover letters, apply across many employer systems, and need to know what happened, when it happened, and what to do next.

The underlying model must also work for experienced applicants, career changers, contractors, and people running a smaller but longer hiring process. Wip should not encode assumptions that all users are students, all roles are full-time, or all hiring processes follow the same stages.

### Problem

Application evidence is scattered across expiring job posts, applicant-tracking portals, documents, calendars, and email. Existing trackers generally record a current status but lose the evidence and chronology behind it. That makes simple questions unexpectedly hard:

- What did the employer originally advertise?
- Which resume and cover-letter version did I submit?
- When did I apply, receive a reply, interview, follow up, or get rejected?
- Which application needs attention today?
- Is an automatically inferred status accurate?

### Product promise

Wip gives an applicant a trustworthy, chronological record of each hiring process and turns that record into clear next actions. It preserves the job description the user actually saw, remembers the documents used, and keeps the user—not an extraction model—in control of consequential status changes.

### Differentiator

Wip is an evidence-backed application history rather than a status spreadsheet or an auto-apply engine. The differentiating combination is:

1. an immutable job-description snapshot with capture provenance;
2. an event-first timeline rather than an overwritten status field;
3. document-version attribution for each application;
4. user-confirmed automation with visible confidence and source; and
5. explicitly opt-in, cohort-protected aggregate hiring timelines.

### Product principles

- **Evidence before inference:** preserve source content and provenance where possible.
- **History before status:** current stage is a projection of confirmed events, not the only record.
- **The user is the authority:** automated suggestions remain proposals until confirmed.
- **Useful today:** prioritize due actions and review requests over vanity charts.
- **Private by default:** personal tracking works without contributing to aggregate statistics.
- **General underneath:** the initial language may be friendly to new graduates, but the data model and workflows remain broadly applicable.

## 2. Core concepts

### Application

An application is the user's record for one role at one employer. It can begin before submission. It owns snapshots, timeline events, document uses, contacts, notes, and next actions.

### Job-description snapshot

A snapshot is an immutable preservation of the job-description content at a moment in time. For the MVP, “exact” means the captured job-description content and meaningful formatting are preserved as sanitized HTML plus plain text, together with source URL, capture time, page metadata, extraction version, and a content hash. Scripts, trackers, hidden page state, and unrelated navigation are excluded.

This is a faithful semantic snapshot, not a pixel-perfect screenshot, WARC archive, or promise to reproduce the entire source page. Screenshots and full-page archives are postponed. Each recapture creates a new snapshot; an existing snapshot is never overwritten. The user previews extension captures before saving. Milestone 1 supports a manual pasted snapshot; Milestone 2 adds current-page capture.

### Event and current stage

An event records something that happened, with an occurrence time and source. The default user-facing stages are:

`saved` → `preparing` → `applied` → `assessment` → `interviewing` → `offer`

Terminal outcomes are `accepted`, `rejected`, and `withdrawn`. `assessment` includes online assessments, HireVues, coding tests, and take-home assignments; an application may skip it or return to it. Archival is independent of stage. The projection may move backward after a correction, and not every application visits every stage. Ghosting is a derived analytical outcome, not a manually selected stage. User-facing operational screens should use neutral language such as “awaiting response” until a future analytical definition is approved.

Only confirmed events participate in the current-stage projection. Manual events are confirmed at creation. Automated status-changing events remain pending until the user approves them.

### Next action

A next action is a concrete task such as “follow up with Maya” or “prepare examples for interview,” with an optional due time and reminder. An application may have several actions, but Today emphasizes the earliest incomplete one.

## 3. Primary experiences

### Today screen

Today is the default signed-in screen and answers “What should I deal with now?” It contains, in this order:

1. **Upcoming:** scheduled interviews and assessments ordered by occurrence time.
2. **Overdue follow-ups:** incomplete follow-up actions whose due time has passed.
3. **Awaiting responses:** submitted applications with no qualifying employer response yet, described neutrally rather than labeled ghosting.
4. **Recently changed:** the latest confirmed application changes.
5. **Stage summary:** a compact count across the current application stages.

Later, **Needs your review** appears ahead of these sections for pending automated event proposals, each showing application, proposed change, source, confidence, and confirm/reject actions. This section is absent until Milestone 3.

The screen includes quick actions for adding an application and adding a next action. Completing an action updates it in place and appends an auditable event. Empty states explain the next useful action and can load local development demo data only in a demo/development environment.

### Applications table

The table is the high-density canonical index. Default columns are:

- company;
- role;
- location;
- current stage or outcome;
- applied date, if any;
- next action and due time;
- last confirmed activity; and
- source or job URL indicator.

Users can search company and role, filter by stage/outcome, next-action state, and archived state, and sort by last activity, applied date, next-action due time, company, or role. The default is active applications ordered by next-action urgency and then recent activity. Filters are reflected in the URL so views are shareable across the user's own devices.

On narrow screens, each row becomes a compact card with company, role, stage, and next action; secondary fields move into an expandable area. Bulk editing and destructive bulk actions are not part of the MVP.

### Optional Kanban view

Kanban is postponed until the end of Milestone 1. When implemented, it is a second view over the same application query, never a separate source of truth. Columns correspond to the default stages and terminal outcomes. Archived applications are hidden by default; terminal columns may be collapsed.

Dragging a card creates a confirmed manual status event and immediately updates the projection. Before saving an unusual backward or terminal transition, Wip asks for confirmation. Every drag operation has keyboard and menu equivalents, and users can always switch back to the table. The table is the default because it scales better and exposes dates and next actions.

### Application-detail screen

The detail screen combines facts, evidence, and actions for one application:

- **Header:** company, role, current stage/outcome, location, source URL, requisition ID, archive control, and primary action.
- **Next action:** earliest incomplete action plus controls to add, reschedule, complete, or cancel actions.
- **Timeline:** reverse-chronological by default, with an option for oldest-first. Each event shows what happened, occurrence time, source, confirmation state, and confidence when applicable. Pending automated proposals are visually distinct and do not alter current stage.
- **Job description:** the active immutable snapshot with capture time, original URL, content hash indicator, and snapshot-version selector. The original source can be opened separately.
- **Documents used:** explicit resume, cover-letter, portfolio, or other document versions associated with the application.
- **Contacts:** recruiter, referrer, interviewer, hiring manager, or other contacts, with optional minimal contact details.
- **Notes:** user-authored context. Notes are not silently mined for sensitive attributes or aggregate statistics.
- **Application facts:** dates and source metadata that are useful for filtering but do not replace the timeline.

On mobile, these sections appear as a single readable column with timeline, next action, and pending review ahead of secondary metadata.

## 4. MVP scope

For planning purposes, the launch MVP spans Milestones 1 and 2: a manually useful web tracker plus intentional current-tab capture. Milestone 1 must be independently useful without the extension. Milestone 1A is a front-end-only vertical prototype using fictional seed data. Milestone 1B-1 introduces the read-only Neon PostgreSQL persistence foundation; Milestone 1B-2 adds Clerk authentication, empty authenticated owners, and strict Neon/PostgreSQL RLS while remaining read-only; Milestone 1B-3 adds manual mutations and production API commands.

### Included in the MVP

- Account sign-in with Clerk Google/passwordless email links and strict per-user data isolation in Milestone 1B-2.
- Manual application create, edit, archive, and delete.
- Manual immutable job-description snapshots, followed by extension capture in Milestone 2.
- Manual chronological events and derived current stage.
- Today, applications table, and application detail in Milestone 1A; Kanban at the end of Milestone 1.
- Document-version metadata and explicit application/document associations; file upload is not required.
- Contacts, notes, and next actions.
- In-app due and overdue reminders; external push/email reminders are later.
- Seeded fictional demo data for development, test, and product demonstration.
- Basic user-data export and deletion paths before inviting real beta users.
- Responsive and keyboard-accessible behavior.

### Later features

- Forwarded-email ingestion, extraction, confidence display, and approval workflow.
- Browser, email, push, or calendar reminders.
- Opt-in Hiring Pulse aggregates and cohort comparisons.
- Richer capture adapters for specific applicant-tracking systems after the generic extractor is proven.
- Optional storage of document files; the default remains metadata-only.
- Import from existing trackers and export formats beyond the baseline JSON/CSV set.
- Calendar integration, contact enrichment, collaboration, and multi-user workspaces only if validated.
- More advanced analytics, with statistical definitions and privacy review completed first.

## 5. Explicit non-goals

Wip will not provide the following in the scoped roadmap:

- auto-apply;
- mass application submission;
- resume or cover-letter generation;
- native mobile apps;
- job discovery or a job marketplace;
- broad LinkedIn scraping;
- background collection of general browsing history;
- applicant ranking, employability scores, or predictions about an individual's chance of an offer; or
- employer surveillance or contact enrichment without the user's explicit input.

## 6. Functional rules

- Application creation requires company and role; all other fields may be added later.
- Applying is recorded as an event. `applied_at` shown in lists is a projection of the confirmed submission event, not an independently editable truth.
- Manual event occurrence time may be backdated. Creation time is always system-generated and retained separately.
- Correcting history creates a correction/superseding record. Wip must not hide that the correction occurred.
- One document version may be used by many applications. Replacing a document file or label creates a new version; it does not rewrite past uses.
- A pending or rejected automated proposal cannot change Today counts, current stage, or aggregate contribution.
- The extension runs only after a user gesture, shows a capture preview, and transmits only the reviewed job content and required metadata.
- “Ghosting” must not be displayed as a definitive employer action until its definition, observation window, and caveats are approved.

## 7. Baseline success measures

Milestone success is primarily behavioral and reliability-oriented, not growth-oriented:

- A new user can add an application and useful next action in under two minutes.
- A returning user can identify the most urgent action from Today without opening every application.
- A user can reconstruct the sequence of an application and the document versions used.
- A source job post can disappear without making the saved description unavailable.
- No automated status-changing event affects canonical stage before confirmation.
- Cross-user authorization and deletion/export paths pass automated tests before real-user beta.

Aggregate hiring outcomes are not an MVP success metric because aggregate contribution is later and optional.

## 8. Open product dependencies

The following remain open before later Milestone 1 or beta work; confirmed Milestone 1A decisions are recorded in `docs/decisions.md`:

- public name and domain;
- reminder defaults and timezone behavior; and
- detailed Kanban terminal-column behavior for the end-of-Milestone-1 slice.
