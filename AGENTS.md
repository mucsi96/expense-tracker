# Expense Tracker - Development Guidelines

## General Code Style

- Avoid fallbacks, prefer failing fast
- Prefer functional programming patterns
- Prefer immutable data structures

## Java Style

- Use Lombok annotations (@Data, @Builder, @RequiredArgsConstructor)
- Constructor injection (via @RequiredArgsConstructor)
- Use Stream API for collections
- Use records for DTOs/responses

## TypeScript Style

- Use `const` by default
- Prefer spread operator for object/array operations
- Use functional array methods (map, filter, reduce)
- Use string literals over enums

## Testing Style

- Write tests from user perspective
- Use role-based selectors (getByRole)
- Use semantic selectors (getByText, getByLabel)
- E2E tests with Playwright

## Angular Style

- Use Angular Material components
- Use signals and resources (not rxjs where possible)
- Use string literals over enums
- Standalone components

## Design

- Material UI dark theme
- Skeleton loaders for loading states

## Project Overview

A web app to track expenses, revenues, and budget. Built on the patterns of
[skeleton-app](https://github.com/mucsi96/skeleton-app):
- CI/CD pipeline (GitHub Actions)
- Deployment (Docker images published to registry)
- Client (Angular with Material UI)
- Server (Spring Boot with Java 21)
- Authentication (Azure AD / MSAL)
- Configuration (Azure Key Vault, Spring profiles)
- Database (PostgreSQL with JPA)
- Testing (Playwright E2E)

## Architecture

- **client/** - Angular SPA with Material UI, OIDC authentication
- **server/** - Spring Boot REST API with PostgreSQL
- **mock_exchange_rate_server/** - Express mock of the Frankfurter exchange
  rate API, used by the E2E test pod
- **test/** - Playwright E2E tests
- **scripts/** - Build and deployment scripts
- **.github/workflows/** - CI/CD pipelines

## Key Technologies

- Spring Boot 4, Java 21
- Angular 22
- PostgreSQL 17
- Azure AD (OIDC) authentication
- Azure Key Vault for secrets
- Traefik reverse proxy
- Docker multi-stage builds
- Playwright for E2E testing

## Development Commands

### Frontend
```bash
cd client && npm start        # Start dev server
cd client && npm run build    # Production build
```

### Backend
```bash
cd server && mvn spring-boot:run -Dspring-boot.run.profiles=local  # Start with local profile
```

### Podman Development
```bash
scripts/pod_up.sh             # Build images and start test pod
scripts/pod_down.sh           # Stop and clean up test pod
scripts/dev_db_up.sh          # Start development PostgreSQL database
scripts/dev_db_down.sh        # Stop development database
```

### Testing
```bash
cd test && npm test           # Run E2E tests
cd test && npx playwright test --ui  # Interactive test runner
```

## API Routes

- `GET /api/environment` - Client configuration (public)
- `GET /api/expenses` - List expenses (authenticated)
- `DELETE /api/expenses` - Delete all expenses (authenticated)
- `PUT /api/expenses/{id}/category` - Assign an existing category to an
  expense (authenticated; unknown categories are rejected with 422). Also
  binds the category to the expense's merchant (the description):
  every other expense at the same merchant is re-categorized and the
  binding is applied to future imports
- `GET /api/categories` - List categories sorted by name (authenticated)
- `POST /api/categories` - Create a category with optional emoji and
  description (authenticated; duplicate names are rejected with 409)
- `PUT /api/categories/{id}` - Update a category's name, emoji and
  description; renaming updates all expenses using the old name
  (authenticated)
- `DELETE /api/categories/{id}` - Delete a category; expenses keep their
  category text (authenticated)
- `GET /api/settings` - App settings, currently the monthly closing day
  (authenticated)
- `PUT /api/settings` - Update the settings; a closing day outside 1-31 is
  rejected with 400 (authenticated)
- `POST /api/bank-notifications` - Receive a bank card notification email from
  the Cloudflare email worker (bearer-token authenticated, see below)

## Data Model

- **expenses** - Stores expenses (date, description, location, category,
  amount, currency, converted_amount, base_currency, method, type, comment)
- **categories** - Stores the categories offered when assigning transactions
  (name unique, optional emoji and description; blank emoji/description are
  stored as null). Expenses reference categories by name, not by foreign key;
  renaming a category rewrites the name on its expenses. The table is managed
  on the mobile-first `/settings/categories` route, and the home route
  assigns a category to a transaction via a bottom sheet. The home list shows
  the category's emoji on the transaction chip and its description as a
  tooltip; the picker sheet shows both.
- **merchant_categories** - Binds a merchant (the expense description,
  unique) to a category name. Recorded/updated whenever a transaction is
  categorized: all expenses at that merchant get the category, and imported
  expenses (e.g. bank notifications) without a category pick up the bound
  one automatically. Renaming a category renames its bindings; deleting a
  category deletes them (while expenses keep their category text). The
  table was seeded from merchants whose existing expenses all share one
  category.

- **settings** - Single row of app settings, seeded by the migration. Holds
  the monthly closing day (default 31): a monthly period ends on that day of
  the month, transactions after it count towards the next month, and the
  period is named after the month it closes in. 31 covers every month end,
  i.e. plain calendar months. Edited on the `/settings` route.

Amounts are always positive; the `type` field ("Expense" or "Income") tells
whether money went out (Debit) or came in (Credit).

`amount`/`currency` hold the original transaction value in the currency it was
made in. `converted_amount`/`base_currency` hold the same value converted to the
reporting currency (CHF by default, configurable via
`expense-tracker.base-currency`). Reporting (e.g. the monthly chart) uses the
converted amount so mixed currencies aggregate correctly, while duplicate
detection uses the original amount.

## Transaction List Filters

The home route filters the transaction list by month and by category. Months
are closing periods, not necessarily calendar months: the configurable
closing day (see the settings table) decides which month a transaction
belongs to, and the chart groups spending the same way. Both
filters live in the URL query (`?month=yyyy-MM&category=<name>`, month
defaulting to the current one and `all` listing every month), so a filtered
view survives a reload and can be shared. A category is picked straight from
the monthly chart - by tapping a stacked bar segment, a category in the
legend, or a row in the chart tooltip. A bar segment or tooltip row also
selects the month it belongs to; the legend spans every month and keeps the
selected one. The active category is shown as a chip above the month filter
that clears the filter when tapped, next to the number of matching
transactions, and the total spend follows both filters. Category picks push a
history entry so the back gesture returns to the unfiltered list, while month
switches replace it. Uncategorized transactions are hidden while a category is
selected, and they are left out of the chart entirely - every category in the
chart is one the list can be filtered by.

## Bank Notifications

A Cloudflare Email Worker receives bank card notification emails and forwards
each one as JSON (`from`, `to`, `subject`, `raw`) to
`POST /api/bank-notifications`. The endpoint parses the card debit
notification into a "Card payment" expense. The HTML part of the raw MIME
message is decoded (quoted-printable/base64 transfer encodings, nested
multiparts), reduced to its text (tags stripped, `<br>`/block ends become
line breaks, basic entities decoded) and the transaction is extracted from
it. Plain-text parts are ignored — the banks' notifications carry the
transaction only in HTML while their sole plain-text part is a legal
disclaimer — so an email without an HTML part is not recognized. The
notification must be bracketed between `<!-- NOTIFICATION_CONTENT_BEGIN -->`
/ `<!-- NOTIFICATION_CONTENT_END -->` comment markers (as UBS does); only
that region is considered, so money values in headers, previews or footers
cannot shadow the transaction, and HTML without the markers is not
recognized. Extraction rules:

- **amount** - a labeled line (`Amount: CHF 12.50`, `Betrag: ...`) or the
  first `CHF 12.50` / `12.50 CHF` money value with a valid ISO 4217 code
  (pseudo-currencies like XXX are rejected so masked card numbers don't match)
- **merchant** (stored as the description) - a labeled line
  (`Merchant: ...`, `Händler: ...`), the `... CHF 12.50 at Coffee Shop ...`
  charge sentence, or the sentence following
  `CHF 12.50 have been charged to card "1234".` (UBS phrasing)
- **date** - a labeled line (`Date: 04.08.2026 08:44`) or an `on 04.08.2026`
  sentence (interpreted in Europe/Zurich), falling back to the email's `Date`
  header

Foreign amounts go through the usual currency conversion for the transaction
date, and the regular duplicate detection (same day, description and whole
amount) swallows redelivery of the same email. A notification where amount,
merchant or date cannot be extracted is not recognized: it is logged as an
error with all email details (from, to, subject and raw content, exactly what
the endpoint logged before parsing existed) and rejected with 422 so the
worker fails the delivery and the parser can be extended from the logs.

The endpoint is not part of the Azure AD user flow; it has its own security
filter chain that authenticates the worker with a static bearer token compared
in constant time. The token comes from the `bank-notification-token` property —
the Azure Key Vault secret of the same name in prod, fixed values in the `test`
and `local` profiles. A missing or blank token fails startup; a missing or
wrong `Authorization: Bearer` header yields 401, which makes the worker fail
the delivery so the sending mail server retries later.

### Currency conversion

Foreign-currency transactions are stored with both their original amount and a
converted amount in the base currency (CHF). Conversion uses the public
[Frankfurter](https://frankfurter.dev) exchange-rate API (ECB reference rates,
no API key), looked up for the transaction date and cached in memory for one
day (`expense-tracker.exchange-rate-api-url`, default `https://api.frankfurter.dev/v1`).
Rows already in the base currency are stored unchanged; a foreign amount without
a transaction date fails fast rather than being silently treated as CHF. E2E
tests run the real provider against a Frankfurter-compatible Express mock
(`mock_exchange_rate_server/`, wired into the test pod and pointed at via
`application-test.yml`) so tests need no external network. Prod/local
deployments need outbound access to the API host.

Duplicates are skipped: an expense with the same day, description and whole
(original) amount as an existing one is not stored again. Using the original
amount keeps duplicate detection stable regardless of conversion.

## Configuration Patterns

### Spring Profiles
- **prod** - Production with Azure Key Vault and AAD
- **local** - Local development with Podman DB
- **test** - Testing with mock OIDC provider

### Environment Config
- Server exposes `/api/environment` endpoint
- Client fetches config before bootstrap
- Conditionally enables mock OIDC based on `mockOAuth2ServerUri`
