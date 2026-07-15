# Expense Tracker

A web app to track expenses, revenues, and budget. Bank and card statement
CSV exports are imported, de-duplicated and listed with an AI-generated
spending insight.

Based on the patterns from [skeleton-app](https://github.com/mucsi96/skeleton-app).

## Patterns Covered

- **CI/CD Pipeline** - GitHub Actions with E2E testing and image publishing
- **Deployment** - Docker multi-stage builds with Traefik reverse proxy
- **Client** - Angular with Material UI dark theme
- **Server** - Spring Boot with Java 21
- **Authentication** - Azure AD (OIDC) with conditional mock auth for testing
- **Configuration** - Azure Key Vault + Spring profiles (prod/local/test)
- **AI Integration** - Anthropic Claude via Spring AI
- **AI Mocking** - Express mock server for testing
- **Database** - PostgreSQL with Spring Data JPA and Liquibase
- **Testing** - Playwright E2E tests
- **UI Components** - Material UI with custom dark theme
- **Fetching** - Angular resource API with HttpClient

## Port Mapping

All host-exposed ports use the **xx60–xx69** range for their last two digits to
avoid clashes with other local projects (skeleton-app uses xx50–xx59).

| Port | Service              | Context                             |
|------|----------------------|-------------------------------------|
| 3060 | Mock Anthropic API   | Test pod                            |
| 4260 | Angular dev server   | Local dev                           |
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

```bash
# Start test stack
scripts/pod_up.sh

# Run E2E tests
cd test && npm test
```
