# Backend operations

The backend follows skeleton-app's Rust/Loco lifecycle: `src/app.rs` loads typed
configuration, registers routes and middleware, and runs SeaORM migrations.
Controllers extract typed payloads; services own transactions and business
rules. `cargo run -- start` starts the app; `cargo run -- db status` shows migrations.

## Configuration

`LOCO_ENV` selects `config/development.yaml`, `test.yaml`, or `production.yaml`.
`PORT` and `BINDING` set the listener. Development/test require `DATABASE_URL`,
`OIDC_ISSUER`, `API_CLIENT_ID`, and `BANK_NOTIFICATION_TOKEN`; test also requires
`EXCHANGE_RATE_API_URL`. For development, export the gitignored `server/.env`
before starting: `set -a; . ./.env; set +a` from `server/` (VS Code's launch
configuration loads this file directly).
`BASE_CURRENCY` defaults to CHF in development/production.

Production uses `AZURE_KEYVAULT_ENDPOINT` and Azure workload identity to read
the existing `db-url`, `db-username`, `db-password`, `tenant-id`, `api-client-id`,
and `bank-notification-token` secrets. The database URL accepts the existing
JDBC PostgreSQL prefix and separately supplied credentials. No secret is baked
into the image. Missing required configuration fails startup.

## Persisted data

All connections use the `expensetracker` schema. The baseline creates tables and
the settings row only for a fresh database. An existing schema from the previous
release is adopted without rewriting user data, identities, sequences, or
Liquibase history. It must already have all seven previous migrations applied.
An incomplete schema fails startup; deploy the previous release to finish its
migrations first. The baseline has no destructive rollback. Future changes use
ordinary additive SeaORM migrations. Never use `db reset` against persisted data.

Category renames and merchant assignment are database transactions. Categories
remain text references on expenses. Amounts remain PostgreSQL decimals and JSON
numbers; UTC timestamps and camelCase fields preserve the client contract.

## Deployment and checks

The non-root distroless image uses the same executable in test and production.
`--healthcheck` probes `/healthz`; readiness checks the database. The application
uses rust-app 7.0.0, preserving the service name, port 8080, `/api` prefix,
workload identity and numbered release image contract. Existing resource limits
are retained until production measurements justify tuning.

Run `cargo fmt --all --check`, `cargo clippy --locked --all-targets -- -D warnings`,
and `cargo build --locked` in `server/`. Run `scripts/pod_up.sh` and then
`npm test` in `test/` for behavior verification. The pod restarts the server
against its migrated database before tests. Production Key Vault and real gateway
integration still require a deployment smoke check.
