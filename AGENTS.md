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
- `POST /api/upload` - Import expenses from a bank/card statement CSV (authenticated)

## Data Model

- **expenses** - Stores imported expenses (date, description, location,
  category, amount, currency, converted_amount, base_currency, method, type,
  comment)

Amounts are always positive; the `type` field ("Expense" or "Income") tells
whether money went out (Debit) or came in (Credit).

`amount`/`currency` hold the original transaction value in the currency it was
made in. `converted_amount`/`base_currency` hold the same value converted to the
reporting currency (CHF by default, configurable via
`expense-tracker.base-currency`). Reporting (e.g. the monthly chart) uses the
converted amount so mixed currencies aggregate correctly, while duplicate
detection uses the original amount.

## CSV Import

Two statement formats are auto-detected by their header row:
- **Account statement** (UTF-8, `;` separated, 14 columns) - mapped to "Direct payment" expenses
- **Card statement** (ISO-8859-1, `;` separated, 13 columns) - mapped to "Card payment" expenses

Format tolerances (newer bank exports):
- Metadata preamble lines (account number, IBAN, balances, ...) and a leading
  `sep=;` line are ignored; only rows matching the column count are imported
- Account statement rows may end with a trailing `;` (parsed as a 15th empty column)
- Dates are accepted as `dd.MM.yyyy` or ISO `yyyy-MM-dd`
- Account statement amount comes from "Individual amount", falling back to the
  absolute value of Debit, then Credit

Summary rows (description "Total per currency" or "Total card bookings") are
not imported.

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
`application-test.yml`) so imports need no external network. Prod/local
deployments need outbound access to the API host.

Duplicates are skipped: an expense with the same day, description and whole
(original) amount as an existing one is not imported again. Using the original
amount keeps duplicate detection stable across re-imports regardless of
conversion.

## Configuration Patterns

### Spring Profiles
- **prod** - Production with Azure Key Vault and AAD
- **local** - Local development with Podman DB
- **test** - Testing with mock OIDC provider

### Environment Config
- Server exposes `/api/environment` endpoint
- Client fetches config before bootstrap
- Conditionally enables mock OIDC based on `mockOAuth2ServerUri`
