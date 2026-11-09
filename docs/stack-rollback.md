# Restore Angular and Spring Boot

The owner requested this rollback on 2026-11-09 because of visual regressions
and because Rust is not the target backend language.

Reverse PRs #72, #70, #68 and #67, restoring the application, build, tests and
deployment to `40f85d0`. Keep gateway/static hosting, bank-worker routing and
the November 6 resource sizing.

The Rust baseline adopted the existing expenses, categories, merchant bindings
and settings without changing rows, sequences or Liquibase history. Deploy
Spring against that schema; do not run SeaORM down migrations or restore an old
database snapshot. SeaORM metadata can remain unused. Databases first created
by Rust without Liquibase history need separate adoption work before this release.

The rollback is an ordinary forward commit and publishes new numbered releases.
CI must validate native builds and Playwright before merge. Production checks
include budget/month filters, category assignment, settings, CSRF enforcement
and bank notifications through their separately authenticated worker endpoint.
