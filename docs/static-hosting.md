# Authentication and deployment contract

Implements [issue #59](https://github.com/mucsi96/expense-tracker/issues/59)
following the [shared architecture](https://github.com/mucsi96/skeleton-app/issues/105).

## Ownership

- p07 `expense_tracker.tf`: Entra Web registration, oauth2-proxy 8.0.0, shared
  Redis session configuration, Azure website/Blob storage, exact app-origin
  CORS, CI upload roles and deployment secrets. Existing API registration,
  expense roles, database credentials, schema, worker token and PVs are retained.
- Application charts: spring-app **37.0.0** checks sessions on `/api` and forwards
  access tokens; static-client-app **5.0.0** authenticates document navigation,
  rewrites SPA deep links and strips credentials before fetching Azure HTML.
- Backend: validates JWT issuer, audience, scope and roles and requires CSRF for
  mutations even when the gateway supplies bearer authentication. The bank
  filter chain independently validates its worker token and is CSRF-exempt.
- Logging: exact same-origin `/_telemetry/collect` route with origin/rate controls
  and credential stripping. The bundle compiles the URL and app name.

## Static release

CI builds `client/dist` once. Both E2E and the separate-origin Chromium check use
that artifact. `scripts/prepare-client.mjs` separates `documents/index.html` from
assets, rewrites script/link URLs and makes PWA start/scope/id point at the app
origin. The document base stays `/`; JS/CSS bundles are not rewritten. Vite uses
a relative asset base, including lazy module and CSS imports. Typography uses
system fonts, so no external font origin is needed.

Deployment reads `client-storage-config` (`account_name`, `hostname`,
`assets_base_url`) and `forward-auth-config` (`release_name`, `auth`) from the app
vault. Assets and the manifest upload successfully before index HTML; earlier
hashed bundles remain available. Index is no-store. Helm upgrades reset old
values and replace the client container release with the static-origin chart.
Server images retain numbered GHCR tags; client releases contain a static tarball.

## Coordinated rollout

Provision [p07 PR #68](https://github.com/mucsi96/p07/pull/68) before
merging/deploying this application.
Keep the old SPA registration until cutover completes so the existing client
can continue to sign in during provisioning. p07 adds an exact **POST** route for
`/api/bank-notifications` to `expense-tracker-server:8080`, retaining the worker's
Authorization header; all other API requests use session checks.

After deployment verify signed-out document redirects and API 401s, signed-in
expense/category/settings journeys, CSRF rejection, valid and invalid worker
tokens, deep-link reloads, direct Blob assets, manifest navigation and Faro 202s.
Old browser tabs should reload after cutover. Infrastructure apply and production
smoke checks are separate rollout steps, not part of PR creation.

## Checks

```sh
node --test scripts/prepare-client.test.mjs client/tests/budget-burndown.test.ts
(cd client && npm ci && npm run build)
(cd test && npm ci && npx playwright install chromium)
scripts/pod_up.sh
(cd test && npm test)
scripts/pod_down.sh
```

App tests mock the gateway identity, not backend authorization. Real
oauth2-proxy/Redis and gateway authentication/header integration are covered by
the shared chart suite; the app tests exercise JWT rejection, CSRF, bank delivery,
static hosting and the expense journeys.
