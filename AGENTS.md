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

- Spring Boot 4, Java 21 (built into a GraalVM native image)
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

Local development still runs on a plain JVM. The native image is built only by
the container build - see **Native image and the baked-in Spring profile**
below.

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
the monthly chart - by tapping a stacked bar segment or a category in the
legend. A bar segment also selects the month it belongs to; the legend spans
every month and keeps the selected one. Hovering a bar segment shows a
minimal, non-interactive tooltip with just that category's name and total
for the month. The active category is shown as a chip above the month filter
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

## Native image and the baked-in Spring profile

The server is compiled ahead of time into a GraalVM native executable linked
against musl, so there is no JRE in the runtime image and startup is in the tens
of milliseconds rather than seconds.

Ahead-of-time processing resolves bean definitions at build time, which means
the active Spring profile is decided by the build, not by the environment:
Spring AOT emits an `EnvironmentPostProcessor` that activates the profile the
image was built with. `SPRING_PROFILES_ACTIVE` is no longer read at runtime, and
`test/test-pod.yaml` no longer sets it. Build one image per profile with the
`SPRING_PROFILE` build argument - `test` for the e2e pod, `prod` for the image
published to Docker Hub:

```bash
podman build --build-arg SPRING_PROFILE=test \
  -t localhost/expense-tracker-server:test server
```

Build-time details that live in `server/pom.xml` and are easy to trip over:

- AOT processing refreshes the application context, so every placeholder an
  auto-configuration condition reads has to resolve during the build. The
  `process-aot` execution supplies build-time stand-ins for them and turns the
  Key Vault property source off, so the build never reaches out to Azure. The
  stand-ins are not baked into the image; they only have to make the same
  conditions match as the real values do at runtime. A new required environment
  placeholder read by a condition means adding it there too. Placeholders that
  are only read while creating beans (`${db-url}`, `${bank-notification-token}`)
  are resolved at runtime as before and need nothing.
- Spring AOT generates bean-definition classes into the packages of the
  configuration classes it processes, including the signed Spring Cloud Azure
  jars. Mixing generated (unsigned) and signed classes in one package makes the
  native-image builder throw `SecurityException: ... signer information does not
  match`, so the builder is pointed at `server/native-image.security`, which
  disables jar signature verification.
- Jars can ship a `META-INF/native-image/.../native-image.properties` that forces
  classes to build-time initialization. When such a class holds on to objects of
  types that are still initialized at run time, the builder fails with
  `UnsupportedFeatureException: An object of type ... was found in the image
  heap`. `--initialize-at-build-time` in the `native-maven-plugin` config covers
  the Jackson core classes `azure-core` leaves behind that way. Note that a build
  cannot undo such a directive: `exclude-config` does not apply to
  `native-image.properties`, and `initialize-at-run-time` for the same class is
  rejected outright. That is why `azure-core` is pinned ahead of the version the
  Azure BOM selects - the BOM's 1.58.1 forces SLF4J and logback to build-time
  initialization, which is irreconcilable with Spring Boot setting logging up at
  run time. Check this again when the Azure BOM moves.
- The Azure SDK's `ExpandableStringEnum` constants are built by instantiating the
  subclass reflectively, and `fromString` returns `null` rather than failing when
  it cannot. Missing reflection metadata therefore surfaces as every constant of
  a class being `null` and a `NullPointerException` far from the cause.
  `AzureNativeHints` registers the subclasses azure-identity does not ship
  metadata for.
- azure-core decides how to read a response body by asking the model class
  whether it declares the `fromXml` / `fromJson` pair azure-xml and azure-json
  generate, and it asks with `Class.getDeclaredMethods()`. In a native image that
  returns nothing for a class with no reachability metadata, so the answer is
  silently "no" and azure-core falls back to Jackson - for XML that means an
  `XmlMapper`, and jackson-dataformat-xml is not on the classpath, so the call
  dies with a `NoClassDefFoundError`. The SDK ships metadata for most of its
  models but not all. `AzureNativeHints` scans `com.azure` and registers every
  `XmlSerializable`, `JsonSerializable` and `HttpResponseException` instead of
  naming the ones missing today, so an SDK upgrade cannot reintroduce this.
- The Key Vault property source is configured by an `EnvironmentPostProcessor`
  that runs before there is an application context and reads its own settings
  with a plain `Binder` over `AzureKeyVaultSecretProperties`. Nothing in the
  framework infers that, and the auto-configuration that would otherwise
  contribute the binding metadata for that type never matches here - it is
  conditional on `spring.cloud.azure.keyvault[.secret].endpoint`, while this
  application configures the endpoint under `...secret.property-sources[0]`. With
  no members in the image the binder binds nothing, and an absent binding is
  indistinguishable from an empty configuration, so the post-processor quietly
  concludes there is no property source to add. Nothing fails at that point: the
  image starts and then dies much later on the first secret-backed placeholder.
  `KeyVaultPropertySourceNativeHints` supplies the metadata. Only the prod
  profile reads secrets from Key Vault, so no test covers this - after changing
  anything about the Key Vault configuration, check that the generated
  `target/spring-aot/main/resources/META-INF/native-image/**/reachability-metadata.json`
  still carries `AzureKeyVaultSecretProperties` and
  `AzureKeyVaultPropertySourceProperties` with their accessors.

Spring Cloud Azure needs one workaround in application code:
`AzureGlobalPropertiesConfiguration` re-declares the `AzureGlobalProperties`
bean. Spring Cloud Azure registers it from an `ImportBeanDefinitionRegistrar`
using a lambda instance supplier, which AOT cannot turn into generated code, so
it drops the bean and the image fails to start with "required a bean of type
AzureGlobalProperties that could not be found". See the class comment for why it
uses its own bean name. That workaround turns on Spring Cloud Azure's
registration order, which is not a public contract, so smoke-test the image
whenever `spring-cloud-azure-dependencies` moves - a change there could drop the
bean again with no compile-time signal.

The MIME parsing behind `/api/bank-notifications` needs nothing: angus-mail and
angus-activation ship native-image features of their own that register the mail
providers and content handlers.

The image is deliberately not built with `--static`. A fully static binary links
but then segfaults the moment it starts in the container - before GraalVM
installs its own segfault handler, so with no output whatsoever, which looks
exactly like a container that silently never starts.

### Reproducing AOT problems without a native build

Most AOT problems reproduce without waiting for a native compile (which takes
several minutes). Run the AOT-processed application on a normal JVM:

```bash
cd server
mvn -Pnative package -DskipTests -Dapp.profile=test
java -Dspring.aot.enabled=true -jar target/expense-tracker-0.0.1-SNAPSHOT.jar
```

That exercises the generated context - missing bean definitions, profile and
condition mismatches - in seconds. Only class-initialization and reflection
problems need the real `mvn -Pnative native:compile`.

Types that are only ever bound reflectively need explicit hints. Controller
request/response types, JPA entities and Spring Data repositories are covered by
the framework's own AOT processing and need nothing. Types read with a plain
`ObjectMapper` or a `RestClient` want `@RegisterReflectionForBinding` - see
`FrankfurterExchangeRateProvider`, whose exchange-rate response is such a type;
types bound by a `Binder` rather than Jackson want
`BindableRuntimeHintsRegistrar`, which registers exactly what `JavaBeanBinder`
looks for over the whole class hierarchy - see
`KeyVaultPropertySourceNativeHints`.

### Release and image publishing

`publish-server` and `publish-client` each ask `mucsi96/get-next-version` for a
version. It answers from the newest `server-N` / `client-N` tag: no changes under
the component's directory since that tag means no version, and every publish step
is skipped. The release step must therefore tag the commit its image was built
from - `target_commitish: ${{ github.sha }}` - because the action otherwise tags
whatever the default branch points at when the release is created, and the
server's native build takes long enough that another push can land first. A tag
left on a commit that was never built makes the next run believe that commit is
already released, so nothing is published for it. That is silent: `deploy`
resolves the newest tag on Docker Hub by `last_updated` and succeeds, deploying
the previous commit's image, so a fix can look deployed while the running image
predates it. When a change does not reach production, check that a release tag
exists on the commit and that `publish-server` did not skip its build steps.

### Environment Config
- Server exposes `/api/environment` endpoint
- Client fetches config before bootstrap
- Conditionally enables mock OIDC based on `mockOAuth2ServerUri`
