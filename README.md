# Wip

Wip is a user-controlled job-application tracker. The repository now contains Milestone 2A: the Milestone 1C responsive tracker plus a user-invoked WXT/React Chrome Manifest V3 extension that extracts, reviews, and saves the current job through an authenticated API. Clerk provides authentication, Neon PostgreSQL is the event-first system of record, and forced database RLS isolates owners. All checked-in fixtures are deterministic and fictional.

“Wip” is a working product name and has not been legally cleared as a final name.

## Current scope

- Today, Applications, and Application Detail screens
- Intentional signed-out landing plus Clerk sign-in/sign-up and account menu
- Google and passwordless email-link methods, enabled in the Clerk Dashboard
- Internal UUID owner provisioning from a verified Clerk subject
- Clerk-verified, Neon RLS-protected reads behind `ApplicationRepository` and validated writes behind application command services
- Add/edit applications, append manual stage events, manage notes and next actions, optionally paste an immutable semantic snapshot, and permanently delete an application with explicit confirmation
- Table and Kanban views over the same applications, with all nine canonical stages, drag-and-drop, a keyboard-accessible stage selector, transition confirmation, and mutation rollback
- Application contact management and reusable associations
- Metadata-only resumes, cover letters, portfolios, and other documents with immutable versions and explicit application uses
- Versioned full-tracker JSON export, spreadsheet-safe applications CSV export, and exact-phrase deletion of all tracker data while retaining the separate Clerk account
- Stable JSON `/api/v1` read/write routes with Zod validation, request-size limits, same-origin CSRF checks, idempotency for creates/stage events, and stable error bodies
- User-invoked current-tab extraction with JSON-LD first, semantic/ATS fallbacks, visible provenance/confidence, and no background browsing observation
- A keyboard-accessible review popup that sends nothing until Save, retains failed drafts only in `chrome.storage.session`, and clears them after success/cancel
- Authenticated `POST /api/v1/captures` with an exact extension-origin CORS allowlist, server-side HTML sanitization/hashing, transactional application/event/snapshot creation, idempotent retry, and conservative duplicate detection
- Enabled and forced PostgreSQL RLS on all 11 owner/identity tables, with narrow operation/column grants for the Milestone 1C command surface
- An explicit fictional in-memory demo and idempotent database seed
- Unit/UI tests plus opt-in Neon/Clerk mutation and two-user RLS integration tests

Demo mode remains read-only and rejects capture or other mutation requests. Archive/restore, attaching a new snapshot to an existing duplicate, background capture, named-site support promises, Clerk-account deletion, email ingestion, Hiring Pulse, file uploads, billing, Web Store publication, and deployment are not included.

## Requirements

- Node.js 22 or newer
- pnpm 11.9.0 (Corepack can install the pinned version)
- For authenticated mode: a Clerk development instance and disposable Neon development branch
- Chrome for unpacked-extension testing

## Run the explicit fictional demo

```bash
corepack enable
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Development defaults to `WIP_DATA_SOURCE=demo`. Production never silently falls back to demo data.

## Configure Clerk

1. Create a development application in the [Clerk Dashboard](https://dashboard.clerk.com/).
2. Under **User & authentication → Email**, require email, keep **Verify at sign-up** enabled, and enable both **Email verification link** and **Email verification code**. Web sign-in can continue using links; the cookie-free extension popup requires email OTP because Clerk does not support email-link or OAuth redirects in a standalone popup. Password may remain disabled.
3. Under **SSO connections**, add **Google → For all users** and enable it for sign-up/sign-in. Clerk's shared Google credentials are sufficient for a development instance; production will require a separate Google OAuth application.
4. Under **API keys**, copy the development publishable and secret keys.
5. Set the allowed local application URL/path settings so `/sign-in` and `/sign-up` return to `http://localhost:3000`.

Wip uses Clerk's current Next.js `proxy.ts`, server `auth()`/`auth.protect()`, and prebuilt authentication components. Clerk authenticates the request; PostgreSQL RLS remains the authorization boundary for records.

## Configure the Clerk Chrome extension flow

Milestone 2A deliberately does not use Clerk Sync Host because Clerk's documented Sync Host manifest requires the `cookies` permission, which Wip does not request. The extension uses Clerk's standalone Chrome Extension SDK and Native API instead; it sends a short-lived normal Clerk session token to Wip, where Clerk verifies it before the server establishes database tenant context.

1. In the same Clerk development instance, open **Native applications** and enable the **Native API**. Review Clerk's warning that this public request path cannot use browser CAPTCHA in the same way as the web flow.
2. Confirm email verification code is enabled as described above. Google and email-link methods are not available inside a standalone extension popup; users can still use them on the web app.
3. Under **API keys → Quick Copy → Chrome Extension**, copy the public publishable key and exact Frontend API URL into the extension environment described below. Never put the Clerk secret key in `apps/extension`.
4. After loading the unpacked build, copy its 32-character ID from `chrome://extensions`. Add `chrome-extension://<ID>` to the Clerk instance's allowed origins using Clerk's documented instance allowed-origins control. Do not place the secret key or API command in the repository.
5. Put that same exact origin in web `WIP_EXTENSION_ORIGINS`, restart the web server, then rebuild/reload the extension if its configured hosts changed.

Clerk's current official references are [Chrome Extension SDK authentication options](https://clerk.com/docs/reference/chrome-extension/overview), [Native API setup](https://clerk.com/docs/guides/development/deployment/chrome-extension), and [Sync Host permissions](https://clerk.com/docs/guides/sessions/sync-host).

## Configure the Neon runtime role and RLS

1. In the [Neon Console](https://console.neon.tech/), create a project and a disposable development branch near the intended Vercel region.
2. Leave **Data API disabled**. Wip does not use Neon Auth, Neon Data API, or the unrelated OAuth Provider setting.
3. From **Connect**, copy the privileged direct owner URL for migrations and privileged pooled owner URL for fictional seeding. Put them in the gitignored `apps/web/.env.local` as `DIRECT_DATABASE_URL` and `DATABASE_URL`.
4. Apply the checked-in migrations. Migration `0007` creates `wip_runtime` as a locked `NOLOGIN`, `NOBYPASSRLS` role and adds only the current narrow policies/grants:

```bash
pnpm db:migrate
```

5. Generate a unique runtime password locally:

```bash
openssl rand -hex 32
```

6. In the Neon **SQL Editor** on the same branch/database, replace the placeholder and run this once. Do not put the real password in the repository or a screenshot:

```sql
ALTER ROLE wip_runtime LOGIN PASSWORD 'PASTE_THE_64_CHARACTER_VALUE_HERE';
```

7. Copy the pooled owner connection string and create `NEON_RUNTIME_DATABASE_URL` by replacing only its username/password with `wip_runtime` and the generated value. The result has this shape:

```text
postgresql://wip_runtime:YOUR_64_CHARACTER_PASSWORD@YOUR-POOLER-HOST/DATABASE?sslmode=require
```

8. Set `WIP_DATA_SOURCE=neon`, the Clerk keys, and that runtime URL in `apps/web/.env.local`. Optionally seed the isolated fictional demo owner; authenticated users cannot see it because it has no Clerk subject:

```bash
pnpm db:seed
```

9. Start the app and create/sign in to a Clerk test account:

```bash
pnpm dev
```

A first verified request opens a request-local transaction, sets the Clerk-verified subject transaction-locally, and calls the zero-argument `wip_provision_owner()` database function. The function idempotently creates an empty Wip owner and never accepts an owner ID or auth subject from browser input. All authenticated reads/writes use the password-protected `wip_runtime` URL; its role cannot bypass forced RLS. The web runtime never uses either privileged database URL.

## Run the web app and extension together

Copy both placeholder examples to gitignored local files, then replace only the placeholders:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/extension/.env.example apps/extension/.env.local
```

For the web app, set `WIP_DATA_SOURCE=neon`, the existing Clerk/Neon values, `WIP_WEB_ORIGIN=http://localhost:3000`, and the exact Chrome origin in `WIP_EXTENSION_ORIGINS`. For the extension, set the exact local API origin, Clerk publishable key, and Clerk Frontend API origin. Every `WXT_` value is public and may enter the extension bundle; never add a secret or database URL under that prefix.

In two terminals:

```bash
pnpm dev:web
pnpm dev:extension
```

The deterministic local job page is [http://localhost:3000/dev/fixtures/job-posting](http://localhost:3000/dev/fixtures/job-posting). It exists only in development and contains no real company, job, or applicant data.

## Environment-variable boundaries

| Variable                            | Used by                            | Privilege / purpose                                                    |
| ----------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Web Clerk SDK                      | Public instance identifier, not a secret                               |
| `CLERK_SECRET_KEY`                  | Clerk server SDK only              | Secret; never browser/extension-exposed                                |
| `NEON_RUNTIME_DATABASE_URL`         | Authenticated Next.js reads/writes | Passworded `wip_runtime` role, forced-RLS reads and narrow writes      |
| `DIRECT_DATABASE_URL`               | drizzle-kit migration command      | Privileged direct owner connection; never runtime                      |
| `DATABASE_URL`                      | Fictional seed command only        | Privileged pooled owner connection; never authenticated runtime        |
| `WIP_OWNER_ID`                      | Fictional seed tooling only        | Demo owner selector; never authenticated runtime                       |
| `WIP_WEB_ORIGIN`                    | Clerk server request validation    | Exact web origin, normally `http://localhost:3000` in development      |
| `WIP_EXTENSION_ORIGINS`             | Web proxy and capture CORS         | Comma-separated exact `chrome-extension://<32-character-ID>` allowlist |
| `WXT_WIP_API_ORIGIN`                | Extension manifest/client          | Public exact Wip API origin; no path or wildcard                       |
| `WXT_CLERK_PUBLISHABLE_KEY`         | Extension Clerk SDK                | Public Clerk publishable key                                           |
| `WXT_CLERK_FRONTEND_API_ORIGIN`     | Extension manifest                 | Public exact Clerk Frontend API origin needed for Clerk requests       |

No database URL may use a `NEXT_PUBLIC_` prefix.

## Database and validation commands

```bash
pnpm db:generate       # generate a reviewed migration after changing the Drizzle schema
pnpm db:migrate        # apply checked-in migrations with DIRECT_DATABASE_URL
pnpm db:seed           # idempotently seed fictional data with DATABASE_URL/WIP_OWNER_ID
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration  # live tests skip unless their disposable-branch variables exist
pnpm build
pnpm build:extension
pnpm zip:extension
git diff --check
```

For the complete migration/mutation/RLS suite, configure `TEST_DATABASE_URL`, `TEST_NEON_RUNTIME_DATABASE_URL`, `TEST_CLERK_USER_A_ID`, and `TEST_CLERK_USER_B_ID` with fictional subjects. Clerk token verification is covered at the server boundary; the live database suite tests transaction identity and cross-owner RLS. These tests create, mutate, and delete only fictional fixtures and must never target production or a branch with real data.

`drizzle-kit push` is not a production migration strategy for Wip.

## Milestone 1C manual verification

After migrating and signing in with a fictional/test Clerk account:

1. Create an application, refresh it, edit its facts, and add a note, next action, and optional pasted job snapshot.
2. Switch Applications from Table to Board. Move the card with drag-and-drop and with its stage selector; confirm backward or terminal moves and verify Timeline gained an immutable manual event.
3. On Application Detail, create and associate a fictional contact. Create a metadata-only resume or cover letter, append a second version, link a version, and remove a use.
4. In **Data & Privacy**, download the versioned JSON and applications CSV and inspect them locally. Confirm CSV cells beginning with spreadsheet formula characters are neutralized.
5. Type `DELETE MY WIP DATA` to delete the test account's tracker rows. Confirm the account remains signed in with an empty tracker and a second test owner is unchanged.

Use fictional data on a disposable development branch. Tracker deletion is immediate in the active database and has no recovery UI; provider backups may retain deleted bytes for their configured retention window.

## Load and test the unpacked extension

1. Configure both local environment files and run `pnpm build:extension`.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `apps/extension/.output/chrome-mv3`.
3. Copy the generated extension ID. Configure Clerk allowed origins and web `WIP_EXTENSION_ORIGINS=chrome-extension://<ID>`, then restart `pnpm dev:web`.
4. If the host or public Clerk values changed, rebuild the extension and click **Reload** on its card in `chrome://extensions`.
5. Open `http://localhost:3000/dev/fixtures/job-posting`, click Wip in the Chrome toolbar, and confirm the loading state becomes an editable review. No request is sent yet.
6. If signed out, use **Sign in securely** and the email verification-code flow. Review the fields, exact URL, provenance hints, and description, then choose **Save to Wip**.
7. Confirm the success screen opens the created application and its timeline contains one confirmed extension-sourced creation event plus an immutable sanitized snapshot.
8. Invoke Wip again on the same fixture. Confirm it reports **Already in Wip**, opens the existing record, and does not overwrite its snapshot or add another application.
9. Test `chrome://extensions` or an unrelated page: Wip should show a safe unsupported/manual-fallback state without asking for broader access.
10. Choose **Cancel and clear** on a new review and reopen the popup; the prior page content should be gone. Closing Chrome also clears `chrome.storage.session`.

`pnpm zip:extension` creates the packaged artifact under `apps/extension/.output`. Milestone 2A does not publish it to the Chrome Web Store.

## Repository layout

```text
apps/web/            Next.js UI, Clerk/session boundary, repositories, commands, and /api/v1
apps/extension/      WXT/React MV3 popup, current-tab extractor, Clerk client, and capture API client
packages/database/   Drizzle schema, SQL migrations, Neon clients, and seed
packages/domain/     Shared application types and pure calculations
packages/fixtures/   Deterministic fictional application fixtures
packages/schemas/    Shared Zod command validation and inferred TypeScript contracts
docs/                Product, data, privacy, architecture, roadmap, and decisions
```

Read [AGENTS.md](./AGENTS.md) and the documents under [`docs/`](./docs/) before changing product behavior or architecture.
