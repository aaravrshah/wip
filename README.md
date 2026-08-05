# Wip

Wip is a user-controlled job-application tracker. The repository now contains Milestone 1B-2: a responsive, read-only Next.js app with Clerk authentication, idempotent internal-owner provisioning, and Neon PostgreSQL row-level security. All checked-in application records are deterministic and fictional.

“Wip” is a working product name and has not been legally cleared as a final name.

## Current scope

- Today, Applications, and Application Detail screens
- Intentional signed-out landing plus Clerk sign-in/sign-up and account menu
- Google and passwordless email-link methods, enabled in the Clerk Dashboard
- Internal UUID owner provisioning from a verified Clerk subject
- Neon-authenticated reads behind the existing `ApplicationRepository`
- Enabled and forced PostgreSQL RLS on all 11 owner/identity tables
- An explicit fictional in-memory demo and idempotent database seed
- Unit/UI tests plus opt-in Neon/Clerk RLS integration tests

The app remains read-only. Application CRUD, a general API mutation layer, the Chrome extension, email ingestion, Hiring Pulse, file uploads, billing, and deployment are not included.

## Requirements

- Node.js 22 or newer
- pnpm 11.9.0 (Corepack can install the pinned version)
- For authenticated mode: a Clerk development instance and disposable Neon development branch

## Run the explicit fictional demo

```bash
corepack enable
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Development defaults to `WIP_DATA_SOURCE=demo`. Production never silently falls back to demo data.

## Configure Clerk

1. Create a development application in the [Clerk Dashboard](https://dashboard.clerk.com/).
2. Under **User & authentication → Email**, require email, keep **Verify at sign-up** enabled, enable **Email verification link** for sign-up/sign-in, disable password and email-code sign-in, and keep **Require the same device and browser** enabled.
3. Under **SSO connections**, add **Google → For all users** and enable it for sign-up/sign-in. Clerk's shared Google credentials are sufficient for a development instance; production will require a separate Google OAuth application.
4. Under **JWT templates**, create a blank template named `neon`, retain the standard claims, add `{ "aud": "wip-neon" }`, and keep a short lifetime (the Clerk default is 60 seconds).
5. Under **API keys**, copy the development publishable and secret keys. From the instance's Frontend API URL, form the JWKS URL as `https://YOUR_CLERK_FRONTEND_API/.well-known/jwks.json`.
6. Set the allowed local application URL/path settings so `/sign-in` and `/sign-up` return to `http://localhost:3000`.

Wip uses Clerk's current Next.js `proxy.ts`, server `auth()`/`auth.protect()`, and prebuilt authentication components. Clerk authenticates the request; PostgreSQL RLS remains the authorization boundary for records.

## Configure Neon RLS

1. In the [Neon Console](https://console.neon.tech/), create a project and a disposable development branch near the intended Vercel region.
2. Under **Settings → RLS**, configure a JWT/JWKS provider with the Clerk JWKS URL above and expected audience `wip-neon`. Do not enable the separate Data API on the same branch.
3. From **Connect**, copy the privileged direct owner URL for migrations and privileged pooled owner URL for fictional seeding.
4. Copy the passwordless authenticated connection shown by Neon after RLS setup. Wip expects the pooled form: `postgresql://authenticated@HOST-WITH--pooler/DATABASE?sslmode=require`.
5. Copy `apps/web/.env.example` to the gitignored `apps/web/.env.local`, replace the Clerk/Neon placeholders, and set `WIP_DATA_SOURCE=neon`.
6. Apply the checked-in migrations:

```bash
pnpm db:migrate
```

7. Optionally seed the isolated fictional demo owner. Authenticated users cannot see this owner because it has no Clerk subject:

```bash
pnpm db:seed
```

8. Start the app and create/sign in to a Clerk test account:

```bash
pnpm dev
```

A first verified request calls the zero-argument `wip_provision_owner()` database function. The function derives the Clerk subject from Neon-verified JWT context and idempotently creates an empty Wip owner. It never accepts an owner ID or auth subject from browser input.

## Environment-variable boundaries

| Variable                            | Used by                            | Privilege                                                                    |
| ----------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser/server SDK           | Public instance identifier, not a secret                                     |
| `CLERK_SECRET_KEY`                  | Clerk server SDK only              | Secret; never browser-exposed                                                |
| `CLERK_JWT_TEMPLATE`                | Server token retrieval             | Template name; defaults to `neon`                                            |
| `NEON_AUTHENTICATED_DATABASE_URL`   | Authenticated Next.js server reads | Passwordless `authenticated` role, SELECT plus owner-provision function only |
| `DIRECT_DATABASE_URL`               | drizzle-kit migration command      | Privileged direct owner connection; never runtime                            |
| `DATABASE_URL`                      | fictional seed command only        | Privileged pooled owner connection; never authenticated runtime              |
| `WIP_OWNER_ID`                      | fictional seed tooling only        | Demo owner selector; never authenticated runtime                             |

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
git diff --check
```

For the complete RLS suite, configure `TEST_DATABASE_URL`, `TEST_NEON_AUTHENTICATED_DATABASE_URL`, and short-lived Clerk JWTs for two fictional test users in `TEST_CLERK_USER_A_JWT` and `TEST_CLERK_USER_B_JWT`. `TEST_CLERK_EXPIRED_JWT` enables the separate expired-token check. These tests insert only fictional fixtures and must never target production or a branch with real data.

`drizzle-kit push` is not a production migration strategy for Wip.

## Repository layout

```text
apps/web/            Next.js app, Clerk UX/session boundary, and repository adapters
packages/database/   Drizzle schema, SQL migrations, Neon clients, and seed
packages/domain/     Shared application types and pure calculations
packages/fixtures/   Deterministic fictional application fixtures
docs/                Product, data, privacy, architecture, roadmap, and decisions
```

Read [AGENTS.md](./AGENTS.md) and the documents under [`docs/`](./docs/) before changing product behavior or architecture.
