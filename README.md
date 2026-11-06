# Expense Tracker

A web app to track expenses, revenues, and budget. Bank card notification
emails are parsed into expenses, de-duplicated and listed.

Based on the patterns from [skeleton-app](https://github.com/mucsi96/skeleton-app).

## Patterns Covered

- **CI/CD Pipeline** - GitHub Actions with E2E tests, native API images and tested static client artifacts
- **Deployment** - Traefik gateway, Azure static website documents and direct Blob assets
- **Client** - React, Vite and TypeScript with colocated CSS Modules
- **Server** - Spring Boot with Java 21, compiled ahead of time into a GraalVM native image
- **Authentication** - Entra/oauth2-proxy gateway sessions; backend JWT roles and CSRF validation
- **Configuration** - Azure Key Vault + Spring profiles (prod/local/test)
- **Database** - PostgreSQL with Spring Data JPA and Liquibase
- **Testing** - Playwright E2E tests
- **UI Components** - `@mucsi96/react-ui` accessible dark theme and ECharts
- **Fetching** - TanStack Query with Zod-validated API boundaries

## One image per Spring profile

The server is shipped as a GraalVM native executable. Bean definitions are
resolved during ahead-of-time processing at build time, so the active Spring
profile is baked into the executable and cannot be chosen at startup any more.
The server image is therefore built once per profile, via the `SPRING_PROFILE`
build argument:

```bash
podman build --build-arg SPRING_PROFILE=test -t expense-tracker-server:test server   # e2e pod
podman build --build-arg SPRING_PROFILE=prod -t expense-tracker-server:prod server   # published image
```

`SPRING_PROFILES_ACTIVE` is not read at runtime; the pipeline builds the test
image for the e2e job and the prod image when publishing to GHCR. Running
the server on a JVM for local development is unaffected - `mvn spring-boot:run
-Dspring-boot.run.profiles=local` still selects the profile the usual way.

## Gateway authentication and static hosting

The gateway authenticates documents before React starts. OAuth tokens remain
server-side in a per-app oauth2-proxy session backed by shared Redis; the browser
uses a host-only HttpOnly `__Host-session` cookie. React reads display-only
profile data from `/oauth2/userinfo` and sends same-origin API requests. The API
still validates JWT issuer, audience, `api-access` scope and expense roles.
Mutations additionally require the readable Secure `__Host-XSRF-TOKEN` cookie
and matching `X-XSRF-TOKEN` header, including proxy-authenticated bearer requests.

Only POST `/api/bank-notifications` bypasses browser session authentication; its
existing worker bearer token remains mandatory. See [rollout details](docs/static-hosting.md).

CI builds the client once, tests that artifact and publishes it to Azure assets
before updating the document. Icons and lazy chunks load directly from
Blob storage with app-origin CORS. Faro uses the compiled app name
`expense-tracker-client` and same-origin `/_telemetry/collect`. No environment
bootstrap endpoint or document configuration injection is needed.

Local E2E tests use nginx as a file-only origin and Traefik for SPA routes;
Playwright supplies the mock gateway identity while the real API checks JWTs
and CSRF. Standalone `npm start` requires a same-origin authenticated gateway
for API access; the test pod and Playwright fixtures provide the reproducible
development/test path.

## Port Mapping

All host-exposed ports use the **xx60–xx69** range for their last two digits to
avoid clashes with other local projects (skeleton-app uses xx50–xx59).

| Port | Service              | Context                             |
|------|----------------------|-------------------------------------|
| 4260 | Vite dev server      | Local dev                           |
| 5460 | PostgreSQL           | Dev database                        |
| 5461 | PostgreSQL           | Test pod                            |
| 8060 | Mock OAuth2 provider | Test pod                            |
| 8063 | Spring Boot server   | Local dev (VSCode)                  |
| 8064 | Spring Boot server   | Test pod (internal, behind Traefik) |
| 8160 | Traefik (web)        | Test pod                            |
| 8161 | Traefik (admin)      | Test pod                            |
| 8162 | Spring Actuator      | Local dev & test                    |

## Development Environment

System tooling (JDK 21, Maven, Node, jq, kubectl, helm, azure-cli) is provided by
a Nix flake dev shell:

```bash
nix develop          # enter the dev shell manually
# or, with direnv installed, `direnv allow` once and it loads automatically
```

Then install the per-project dependencies:

```bash
scripts/install_dependencies.sh
```

**Podman** is a distro-level prerequisite and is not managed by the flake
(rootless Podman needs setuid `newuidmap`/`newgidmap` helpers the Nix store
cannot provide). On WSL, enable `systemd=true` in `/etc/wsl.conf` and install it
via your distro, e.g. `apt install podman`.

## Quick Start

The frontend requires Node.js 24 or newer. Routes (`/`, `/settings`, and
`/settings/categories`) are lazy-loaded. TanStack Query owns server state and
invalidates expenses when category edits affect merchant bindings; URL search
parameters own the month/category filters. The backend API is unchanged.

```bash
cd client
npm ci
npm run lint
npm test             # Existing framework-independent date calculations
npm run build       # Strict TypeScript checking and production Vite build
```

```bash
# Start test stack
scripts/pod_up.sh

# Run E2E tests
cd test && npm test
```

When running a test pod with remapped host ports, the Playwright suite accepts
`TEST_BASE_URL`, `TEST_OIDC_URL`, and `TEST_DB_PORT` (defaults: localhost ports
8160, 8060, and 5461). These affect test connections only, not API token claims.
