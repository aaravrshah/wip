# Wip

Wip is a user-controlled job-application tracker. The repository currently contains Milestone 1B-1: the responsive, read-only Next.js prototype plus an optional Neon PostgreSQL persistence foundation. All included application data is deterministic and fictional.

“Wip” is a working product name and has not been legally cleared as a final name.

## Current scope

- Today, Applications, and Application Detail screens from Milestone 1A
- A small `ApplicationRepository` boundary with in-memory and Neon read adapters
- Normalized event-first Drizzle schemas and checked-in SQL migrations
- An idempotent database seed containing the same twelve fictional applications
- Explicit owner scoping and same-owner foreign keys in preparation for authenticated RLS
- Unit/UI tests plus opt-in Neon integration tests

This milestone does not include authentication, application mutations, RLS policies tied to an authenticated identity, the Chrome extension, email ingestion, Hiring Pulse, file uploads, or deployment.

## Requirements

- Node.js 22 or newer
- pnpm 11.9.0 (Corepack can install the pinned version)
- Optional: a Neon project and development branch for persistent reads

## Run with in-memory demo data

```bash
corepack enable
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Development and tests default to the explicit fictional demo source. Production runtime does not silently use that fallback.

## Configure Neon

1. In the [Neon Console](https://console.neon.tech/), create a project and choose a region near the intended Vercel region.
2. Create or select a development branch. Do not use a production branch for the fictional seed or integration tests.
3. Open **Connect**, select the branch, database, and role, then copy both connection strings:
   - the pooled runtime string, whose hostname contains `-pooler`;
   - the direct string, whose hostname does not contain `-pooler`.
4. Copy `apps/web/.env.example` to `apps/web/.env.local` and replace only its placeholders. Set `DATABASE_URL` to the pooled string, `DIRECT_DATABASE_URL` to the direct string, `WIP_DATA_SOURCE=neon`, and keep the fictional seeded `WIP_OWNER_ID`.
5. Apply migrations and seed the development branch:

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

drizzle-kit reads `DIRECT_DATABASE_URL` from `apps/web/.env.local`. The seed and Next.js runtime use `DATABASE_URL`. Neither variable may have a `NEXT_PUBLIC_` prefix.

For integration tests, create a separate disposable Neon branch, copy its direct connection string into `TEST_DATABASE_URL`, and run:

```bash
pnpm test:integration
```

The integration suite applies checked-in migrations and inserts fictional records. Never point `TEST_DATABASE_URL` at production or a database containing real user data.

## Database commands

```bash
pnpm db:generate  # generate a reviewed SQL migration after changing the Drizzle schema
pnpm db:migrate   # apply checked-in migrations through the direct connection
pnpm db:seed      # idempotently insert the twelve fictional applications
```

`drizzle-kit push` is not a production migration strategy for Wip.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration  # requires TEST_DATABASE_URL; otherwise the live suite is skipped
pnpm build
git diff --check
```

Use `pnpm format` to apply the repository formatting rules.

## Repository layout

```text
apps/web/            Next.js responsive app and repository adapters
packages/database/   Drizzle schema, SQL migrations, Neon client, and seed
packages/domain/     Shared application types and pure calculations
packages/fixtures/   Deterministic fictional application fixtures
docs/                Product, data, privacy, architecture, roadmap, and decisions
```

Read [AGENTS.md](./AGENTS.md) and the documents under [`docs/`](./docs/) before changing product behavior or architecture.
