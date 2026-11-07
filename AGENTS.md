# Expense Tracker - Development Guidelines

## Code Review Rules

- Review the PR diff for actionable correctness, security, data-loss, and deployment regressions; cite the changed file/line and concrete impact.
- Preserve authentication boundaries, persisted data compatibility, and the project's documented build/test/deploy contracts. Adapt shared patterns to this project's stack.
- Report missing behavioral coverage where it would catch a specific regression; leave formatting and mechanical checks to CI.

## Codex automation

Use native Codex GitHub reviews and `@codex` PR tasks with ChatGPT sign-in.
Setup: https://github.com/mucsi96/skeleton-app/blob/main/docs/codex-automation.md
Skeleton sync: follow `.github/prompts/sync-skeleton.md` in a weekly scheduled task.

## General Code Style

- Avoid fallbacks, prefer failing fast.
- Prefer functional programming patterns and immutable data structures.
- TypeScript: use `const`, spread operators, functional array methods and string literals over enums.

## Rust Style

- Follow skeleton-app's Loco lifecycle and CLI, typed Serde configuration and payloads, thin controllers, typed service errors and structured tracing.
- Use SeaORM models and migrations. Keep multi-row business mutations transactional.
- Preserve the PostgreSQL `expensetracker` schema, existing rows, identifiers and sequences.
- Use decimal arithmetic for amounts; preserve JSON numeric values and camelCase API fields.
- Run formatting, Clippy and build checks. Verify behavior with Playwright; do not add Rust unit/integration tests or React unit/component tests.

## React Style

- Function components and hooks; colocate component CSS Modules.
- Use `@mucsi96/react-ui` accessible controls and its documented `tone` API.
- TanStack Query owns server state; invalidate all affected queries after mutations.
- Validate API responses with Zod; keep OAuth at the gateway and attach the CSRF proof only to same-origin mutations.
- React Router owns routes and URL filters. Lazy-load pages and charts.
- Verify user journeys with Playwright, using role-based and semantic selectors.
- Use the dark theme and skeleton loaders for loading states.

## Architecture

A web app to track expenses, revenues, and budget, based on
[skeleton-app](https://github.com/mucsi96/skeleton-app).

- **client/**: React 19/Vite/TypeScript SPA, CSS Modules, TanStack Query, Zod, ECharts.
- **server/**: Rust/Loco API, SeaORM/PostgreSQL 17, native non-root container.
- **mock_exchange_rate_server/**: Express Frankfurter-compatible E2E mock.
- **test/**: Playwright E2E journeys through the Traefik gateway.
- **scripts/**: build, local database and deployment scripts.
- **.github/workflows/**: CI/CD, numbered GHCR server releases and Azure static client artifacts.

## Development Commands

```bash
cd client && npm start
cd client && npm run lint && npm test && npm run build
cd server && cargo run -- start
cd server && cargo fmt --all --check
cd server && cargo clippy --locked --all-targets -- -D warnings
cd server && cargo build --locked
scripts/dev_db_up.sh
scripts/dev_db_down.sh
scripts/pod_up.sh
scripts/pod_down.sh
cd test && npm test
cd test && npx playwright test --ui
```

Local backend setup and environment variables are documented in
`docs/backend.md`; copy `server/.env.example` to gitignored `server/.env`.
The database is started explicitly by `scripts/dev_db_up.sh`.

## API Routes

- `GET /api/expenses`: list expenses, newest first with null dates last.
- `DELETE /api/expenses`: delete expenses, retaining categories and merchant bindings.
- `PUT /api/expenses/{id}/category`: assign an existing category; unknown categories return 422. Also binds the expense's merchant (description), recategorizes every expense at that merchant, and applies to future imports.
- `GET /api/categories`: list categories sorted by name.
- `POST /api/categories`: create a category with optional emoji/description; duplicate names return 409.
- `PUT /api/categories/{id}`: update metadata; renaming updates expenses and merchant bindings using the old name.
- `DELETE /api/categories/{id}`: delete the category and its merchant bindings; expenses retain their category text.
- `GET /api/settings`: closing day, monthly budget and reporting currency.
- `PUT /api/settings`: closing day must be 1–31; budget must be 0–999999999.99 with at most two decimal places. Invalid values return 400. Omitted/null budget preserves the stored budget.
- `POST /api/bank-notifications`: receive worker email JSON (`from`, `to`, `subject`, `raw`), authenticated separately with a static bearer token.

## Authentication

- Gateway documents authenticate through a per-app oauth2-proxy session before startup.
- `/oauth2/userinfo` supplies display-only profile data; browsers store no OAuth tokens.
- API middleware validates JWT signature, issuer, audience, `api-access` scope, and the appropriate `readExpenses`, `createExpenses` or `deleteExpenses` role.
- Mutations require `__Host-XSRF-TOKEN` / `X-XSRF-TOKEN`, including bearer requests supplied by the proxy.
- Only POST `/api/bank-notifications` bypasses gateway session checks and CSRF. Its constant-time bearer-token check remains mandatory; missing/wrong tokens return 401.
- Missing or blank worker token fails startup. Production uses Key Vault's existing `bank-notification-token` secret.
- `/healthz` is unauthenticated database readiness, used by the native `--healthcheck` command.
- Test fixtures supply gateway identity while the real API validates JWT/CSRF.

## Data Model

- **expenses**: `expense_date`, description, location, category, amount, currency, converted_amount, base_currency, method, type, comment. Categories are text, not foreign keys.
- **categories**: unique name, optional emoji and description; blank metadata is stored as null. Managed at `/settings/categories`; assigned through the home bottom sheet. The list uses category emoji and description tooltips.
- **merchant_categories**: unique merchant description mapped to category name. Assignment updates all expenses at that merchant. Rename updates bindings; delete removes them. Existing bindings were seeded from merchants whose expenses shared one category.
- **settings**: one migration-seeded row, closing day 31 and monthly budget 0 by default. Zero budget means unconfigured. A missing row is an error, not a reason to silently reseed.

Amounts are positive; `type` is `Expense` (debit) or `Income` (credit).
`amount`/`currency` hold original values; `converted_amount`/`base_currency`
hold reporting values (CHF by default). Reporting uses converted amounts,
duplicate detection uses original amounts.

## Budget and Filters

The home page opens on Budget burndown; Monthly spending contains the category
chart. A closing period ends on the configured day (clamped to the month end)
and is named after that closing month. Transactions after it count toward the
next month. Closing day 31 means calendar months.

Burndown is budget minus cumulative converted spending, including uncategorized
expenses and excluding income. Category filters do not affect it. Actuals stop
at today; ideal declines evenly from opening budget to zero at closing. Negative
balances show overspending. All asks for a single month; zero budget links to Settings.

Filters live in URL query parameters (`?month=yyyy-MM&category=<name>`), with
month defaulting to current and `all` listing every month. Chart segment picks
select category and month; legend picks keep the month. The tooltip shows only
category and total. A removable category chip appears next to transaction count;
total spend follows both filters. Category picks push history; month switches
replace it. Uncategorized transactions are excluded while a category is selected
and from the category chart. Date-boundary checks run with
`node --test client/tests/budget-burndown.test.ts` (Node 24+).

## Bank Notifications

Parse raw MIME HTML, decoding quoted-printable/base64 and nested multiparts.
Ignore plain text (bank emails use it for legal disclaimers). Require the
`<!-- NOTIFICATION_CONTENT_BEGIN -->` / `<!-- NOTIFICATION_CONTENT_END -->`
region, ignoring money elsewhere. Strip tags, preserve block/line breaks and
decode basic entities. Extraction supports:

- Amount labels (`Amount`, `Betrag`, `Montant`, `Importo`) or currency-first/last values with valid ISO currencies; reject pseudo-currencies such as XXX.
- Merchant labels, `CHF 12.50 at Coffee Shop ...` sentences, and the sentence after `CHF 12.50 have been charged to card "1234".`
- Date labels or `on 04.08.2026` sentences interpreted in Europe/Zurich; otherwise use the email Date header.

Store as Card payment / Expense. Unknown formats log all original email details
and return 422 so the worker fails delivery and the parser can be extended.
Duplicate identity is UTC day, merchant and whole original amount, truncating
fractional units; redelivery succeeds without another row.

Foreign amounts use Frankfurter historical rates, cached for one day by currency
and transaction date, with decimal half-up rounding to two places. Base-currency
amounts need no request. Tests use the real provider against the mock service;
production needs outbound access to `api.frankfurter.dev`.

## Configuration and Database Lifecycle

One native image serves every environment; `LOCO_ENV` chooses configuration at
runtime. Production uses Azure workload identity and existing Key Vault secrets.
See `docs/backend.md` for environment variables and CLI operations.

The SeaORM baseline initializes only fresh databases. Existing schemas must have
the seven previous release migrations applied and are adopted without modifying
data, identities, sequences or Liquibase history. Never reset/reseed persisted
user data. Baseline rollback is deliberately refused. Future changes use additive
SeaORM migrations. The test pod restarts the server against the migrated DB.

## Release and Deployment

`publish-server` publishes numbered GHCR images only when
`get_next_version.outputs.hasNextVersion == 'true'`, tagging with its `version`.
Authentication uses job-scoped `GITHUB_TOKEN` with `packages: write`. Release
tags use `target_commitish: ${{ github.sha }}`. The action always returns version
and tag; forward the version directly to deployment without another tag lookup.
Publication and rollout are serialized. Require numbered image tags or digests;
the server package must be public for anonymous Kubernetes pulls.

`publish-client` packages tested `client-static` as a release tarball. Deployment
empties `$web` and `assets`, then uploads assets before index HTML. Downtime is
intentional; no production client container is built.

p07 owns auth/storage prerequisites. Deployment uses rust-app 7.0.0 and
static-client-app 5.0.0 with reset values, preserving the API service name, port,
gateway routes and workload identity. See `docs/static-hosting.md`.
Faro's app name and same-origin `/_telemetry/collect` are compiled into the bundle.
