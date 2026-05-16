# DigitalOcean Deployment Runbook

Autoscape deploys to DigitalOcean App Platform as two isolated apps: staging first, production after staging passes smoke tests. Each app has three components and its own managed PostgreSQL database.

## Current Live Status (2026-05-02 UTC)

Staging is created and active in DigitalOcean:

- App: `autoscape-staging` (`658f8cc6-fda5-4d71-a436-606b887bb76e`)
- Region: App Platform `tor`; database `tor1`
- Components: `public-web`, `admin-web`, `api`, `migrate`
- Default ingress: `https://autoscape-staging-w9537.ondigitalocean.app`
- Database cluster: `autoscape-staging-db`, PostgreSQL 16, size `db-s-1vcpu-1gb`
- Database/user names: `autoscape_staging`
- Migration status: the `migrate` pre-deploy job applied all committed Prisma migrations successfully; redeploy `9d5878fa-20e7-4f60-a33d-d876f456cdd4` completed `ACTIVE` with no pending migrations.
- Runtime status: the root, `server/`, `client/`, and `admin/` package manifests pin `engines.node` to `20.x`; DigitalOcean App Platform's Node buildpack reads this package setting for Node version selection.
- Stripe status: the Autoscape sandbox webhook destination `we_1TSTjbFOk9B0ar2ot9otfd2x` sends the seven API-handled event types to `https://api-staging.autoscape.ca/api/stripe/webhook`; `STRIPE_WEBHOOK_SECRET` was rotated on the `api` service and deployed in `5ef1fdfd-a64f-4274-a628-225d45dfccbd`.
- Smoke-test status: authenticated staging smoke passes for custom domains, API health, public/admin SPA routes, CORS, service-area check, draft quote creation, customer Clerk claim/finalize/dashboard, admin Clerk health/list/editor/version submit, verified quote page, CSV export, audit logging, persistence after redeploy, approval-email resend, and Stripe sandbox Checkout/webhook payment confirmation for quote `Q-XFIZFLJX`.

Production is created and active in DigitalOcean:

- App: `autoscape-production` (`d4c4c9f9-f197-4a85-a9ee-352f40e74648`)
- Region: App Platform `tor`; database `tor1`
- Components: `public-web`, `admin-web`, `api`, `migrate`
- Branch/deploy mode: `main`, auto-deploy on push for all components
- Default ingress: `https://autoscape-production-w66ds.ondigitalocean.app`
- Database cluster: `autoscape-production-db` (`f9149079-98cf-4e49-9277-e771a237d659`), PostgreSQL 16, size `db-s-1vcpu-1gb`
- Database/user names: `autoscape_production`
- Migration status: the `migrate` pre-deploy job ran against the empty production database and reports all 10 committed Prisma migrations applied with no pending migrations.
- Runtime status: the current active deployment is healthy; API health returns `{"ok":true,"service":"autoscape-server","mode":"admin-platform-v1"}`.
- Stripe status: live webhook endpoint `we_1TSkCpJuc7sM2vW49NWyXozU` is enabled, `livemode=true`, and sends the seven API-handled event types to `https://api.autoscape.ca/api/stripe/webhook`. Live Stripe secrets are set only in DigitalOcean environment variables.
- Smoke-test status: production HTTPS checks pass for API health, public/admin SPA loads, public/admin CORS preflight, service-area output, and Clerk JWKS at `https://clerk.autoscape.ca/.well-known/jwks.json`.

Staging custom domains use self-managed DNS at GoDaddy:

| Domain | DigitalOcean state | DNS record |
| --- | --- | --- |
| `staging.autoscape.ca` | `ACTIVE` | CNAME to `autoscape-staging-w9537.ondigitalocean.app` |
| `api-staging.autoscape.ca` | `ACTIVE` | CNAME to `autoscape-staging-w9537.ondigitalocean.app` |
| `admin-staging.autoscape.ca` | `ACTIVE` | CNAME to `autoscape-staging-w9537.ondigitalocean.app` |

Current public DNS for `autoscape.ca` remains delegated to `ns63.domaincontrol.com` and `ns64.domaincontrol.com`. Keep the existing Google Workspace, SPF, DKIM, DMARC, Resend, Clerk, and `_domainconnect` records in place when changing App Platform records.

Production custom domains use self-managed DNS at GoDaddy:

| Domain | DigitalOcean state | DNS record |
| --- | --- | --- |
| `autoscape.ca` | `ACTIVE` | A records to `162.159.140.98` and `172.66.0.96`; AAAA records to `2606:4700:7::60` and `2a06:98c1:58::60` |
| `www.autoscape.ca` | `ACTIVE` | CNAME to `autoscape-production-w66ds.ondigitalocean.app` |
| `api.autoscape.ca` | `ACTIVE` | CNAME to `autoscape-production-w66ds.ondigitalocean.app` |
| `admin.autoscape.ca` | `ACTIVE` | CNAME to `autoscape-production-w66ds.ondigitalocean.app` |

Passed staging checks:

- custom-domain API health at `https://api-staging.autoscape.ca/api/health`
- public SPA load and deep-link fallback on `https://staging.autoscape.ca`
- admin SPA load and deep-link fallback on `https://admin-staging.autoscape.ca`
- public/admin CORS preflight from configured staging origins
- service-area check for the Vaughan staging coordinate
- draft quote creation with confirmation route load
- Clerk customer sign-in with a real staging account
- customer quote claim, contact finalization, dashboard list, and dashboard detail
- admin sign-in with a real staging admin organization member
- admin quote inbox, quote editor, version creation, version submit, audit log, and CSV export
- verified quote confirmation page and admin editor page
- quote persistence after App Platform redeploy `9d5878fa-20e7-4f60-a33d-d876f456cdd4`
- approved-quote email resend on quote `Q-XFIZFLJX`
- Stripe sandbox Checkout payment on quote `Q-XFIZFLJX`; Stripe Workbench showed webhook deliveries `Total 1` and `Failed 0`, and the admin editor showed `Status: paid`
- bundle scan for accidental `localhost`/loopback API origins

Production launch validation completed on 2026-05-02 UTC:

- `https://autoscape.ca`, `https://www.autoscape.ca`, and `https://admin.autoscape.ca` return `200` over HTTPS.
- `https://api.autoscape.ca/api/health` returns healthy JSON over HTTPS.
- CORS preflight allows `https://autoscape.ca` and `https://admin.autoscape.ca`.
- `https://api.autoscape.ca/api/service-area` returns the same Vaughan coverage shape used for staging.
- Clerk production JWKS is reachable at `https://clerk.autoscape.ca/.well-known/jwks.json`.
- The Stripe live webhook endpoint is enabled and points at the production API. No live card charge was created during deployment automation.

Staging environment variable audit, names only:

| Key | Status |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | found |
| `CLERK_SECRET_KEY` | found |
| `CLERK_JWT_ISSUER` | found |
| `CLERK_ADMIN_ORG_ID` | found |
| `VITE_CLERK_ADMIN_ORG_ID` | found |
| `VITE_MAPBOX_TOKEN` | found |
| `MAPBOX_STATIC_ACCESS_TOKEN` | no dedicated value found; staging uses the allowed browser-token fallback until a separate static token is added |
| `RESEND_API_KEY` | found |
| `STRIPE_WEBHOOK_SECRET` | found |
| `STRIPE_SECRET_KEY` | found |
| `AUTOSCAPE_BASE_STATIONS_JSON` | found |
| `SERVICE_AREA_REGIONS` | found |
| `SYSTEM_LAUNCH_AT` | found |
| `VITE_SYSTEM_LAUNCH_AT` | found |
| `DATABASE_URL` | DigitalOcean managed database binding only |

Production environment variable audit, names only:

| Key | Status |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | set |
| `CLERK_SECRET_KEY` | set |
| `CLERK_JWT_ISSUER` | set |
| `CLERK_ADMIN_ORG_ID` | set |
| `VITE_CLERK_ADMIN_ORG_ID` | set |
| `VITE_MAPBOX_TOKEN` | set separately for public and admin builds |
| `MAPBOX_STATIC_ACCESS_TOKEN` | set |
| `RESEND_API_KEY` | set |
| `STRIPE_WEBHOOK_SECRET` | set |
| `STRIPE_SECRET_KEY` | set |
| `AUTOSCAPE_BASE_STATIONS_JSON` | set |
| `SERVICE_AREA_REGIONS` | set |
| `SYSTEM_LAUNCH_AT` | set |
| `VITE_SYSTEM_LAUNCH_AT` | set |
| `DATABASE_URL` | DigitalOcean managed database binding only |

## 1) Deployment Topology

| Environment | Branch | App Platform app | Deploy mode | Public domains |
| --- | --- | --- | --- | --- |
| Staging | `staging` | `autoscape-staging` | auto-deploy on push | `staging.autoscape.ca`, `api-staging.autoscape.ca`, `admin-staging.autoscape.ca` |
| Production | `main` | `autoscape-production` | auto-deploy on push | `autoscape.ca`, `www.autoscape.ca`, `api.autoscape.ca`, `admin.autoscape.ca` |

Each app contains:

| Component | Type | Source | Build | Runtime |
| --- | --- | --- | --- | --- |
| `public-web` | static site | `client/` | `npm ci && npm run build` | serves `dist` with `index.html` catch-all |
| `admin-web` | static site | `admin/` | `npm ci && npm run build` | serves `dist` with `index.html` catch-all |
| `api` | web service | `server/` | `npm ci && npm run prisma:generate && npm run build` | `npm start` |
| `migrate` | pre-deploy job | `server/` | `npm ci && npm run prisma:generate && npm run build` | `npm run prisma:migrate:deploy` |

Node runtime selection is pinned in package manifests, not in the App Platform YAML. Keep `engines.node` set to `20.x` in the root, `server/`, `client/`, and `admin/` `package.json` files. DigitalOcean's Node buildpack currently defaults to Node 22 when no engine is specified, so removing those pins can silently change the build/runtime version.

App specs live in:

- `.do/app.staging.yaml`
- `.do/app.production.yaml`

They are templates. Replace every `__SET_IN_DIGITALOCEAN__` value in the DigitalOcean UI or in a private copy before applying. Do not commit secret-filled specs.

## 2) Git Setup

1. Make sure deployment-prep changes are committed on a feature branch.
2. Create or update the integration branch:

```bash
git fetch origin
git switch main
git pull --ff-only
git switch -c staging
git push -u origin staging
```

If `staging` already exists:

```bash
git fetch origin
git switch staging
git pull --ff-only
```

3. Use this flow after the initial setup:

```text
feature branch -> pull request -> staging -> smoke test -> main -> automatic production deploy
```

Production auto-deploys from `main`; only fast-forward or merge staging into `main` after staging smoke tests pass.

## 3) Databases

Create two separate DigitalOcean Managed PostgreSQL databases:

| Environment | Cluster | Database | User |
| --- | --- | --- | --- |
| Staging | `autoscape-staging-db` | `autoscape_staging` | `autoscape_staging` |
| Production | `autoscape-production-db` | `autoscape_production` | `autoscape_production` |

Use Toronto/TOR when available, and keep each app in the same DigitalOcean region as its database. Use Managed PostgreSQL, not an App Platform dev database.

The first Prisma migration runs:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

DigitalOcean Managed PostgreSQL supports the `postgis` extension. If a migration fails because PostGIS cannot be enabled, stop deployment and fix the database plan/permissions before testing quotes.

## 4) Create Staging

1. In DigitalOcean, connect GitHub repo `MartinHaghani/LandscapingWebsite_Codex`.
2. Create an App Platform app from `.do/app.staging.yaml`, or mirror the same settings manually in the UI.
3. Confirm:
   - app name: `autoscape-staging`
   - branch: `staging`
   - auto-deploy: enabled
   - region: Toronto/TOR when available
   - `api` health check path: `/api/health`
   - `api` internal port: `8080`
   - `migrate` job kind: pre-deploy
4. Add the domains:
   - `staging.autoscape.ca`
   - `api-staging.autoscape.ca`
   - `admin-staging.autoscape.ca`
5. Add the DNS records DigitalOcean provides and wait for SSL/domain validation.

## 5) Staging Environment Variables

Set these on `public-web` as build-time env vars:

```text
VITE_API_BASE_URL=https://api-staging.autoscape.ca
VITE_MAPBOX_TOKEN=<staging browser token>
VITE_CLERK_PUBLISHABLE_KEY=<staging publishable key>
VITE_SYSTEM_LAUNCH_AT=2026-03-04T00:00:00.000Z
```

Set these on `admin-web` as build-time env vars:

```text
VITE_API_BASE_URL=https://api-staging.autoscape.ca
VITE_PUBLIC_APP_BASE_URL=https://staging.autoscape.ca
VITE_MAPBOX_TOKEN=<staging admin browser token>
VITE_CLERK_PUBLISHABLE_KEY=<staging publishable key>
VITE_CLERK_ADMIN_ORG_ID=<staging admin org id>
VITE_SYSTEM_LAUNCH_AT=2026-03-04T00:00:00.000Z
```

Set these on `api` as runtime env vars:

```text
NODE_ENV=production
DATABASE_URL=<staging managed postgres url or ${autoscape-staging-db.DATABASE_URL}>
CLIENT_ORIGIN=https://staging.autoscape.ca,https://admin-staging.autoscape.ca
PUBLIC_APP_BASE_URL=https://staging.autoscape.ca
PUBLIC_API_BASE_URL=https://api-staging.autoscape.ca
SERVICE_AREA_REGIONS=Vaughan, Ontario
AUTOSCAPE_BASE_STATIONS_JSON=<server-only station config json>
CLERK_SECRET_KEY=<staging secret key>
CLERK_JWT_ISSUER=<staging issuer>
CLERK_ADMIN_ORG_ID=<staging admin org id>
SYSTEM_LAUNCH_AT=2026-03-04T00:00:00.000Z
RESEND_API_KEY=<staging resend key>
APPROVED_QUOTE_EMAIL_FROM=Autoscape <contact@autoscape.ca>
APPROVED_QUOTE_EMAIL_REPLY_TO=contact@autoscape.ca
MAPBOX_STATIC_ACCESS_TOKEN=<mapbox static image token>
STRIPE_SECRET_KEY=<staging Stripe test secret key>
STRIPE_WEBHOOK_SECRET=<staging Stripe webhook signing secret>
```

Set `DATABASE_URL` on the `migrate` job as the same staging database URL/bindable variable.

## 6) External Service Setup

Google Workspace / DNS:

- `autoscape.ca` business mailbox traffic uses Google Workspace MX records.
- Keep root SPF as a single TXT record that authorizes all legitimate senders; do not add duplicate `v=spf1` records.
- Enable Google Workspace DKIM before relying on business email deliverability: generate the `google._domainkey` TXT record in Google Admin Console, publish it in GoDaddy DNS, then start authentication in Google Admin.
- Keep DMARC active only after every legitimate sender is SPF/DKIM aligned. Current quote-email sender alignment depends on the verified Resend domain and `send.autoscape.ca` return path.

Clerk:

- Use staging/dev Clerk keys for staging.
- Add allowed origins and redirect URLs for `staging.autoscape.ca` and `admin-staging.autoscape.ca`.
- Confirm `CLERK_ADMIN_ORG_ID` and `VITE_CLERK_ADMIN_ORG_ID` point to the same staging admin organization.

Mapbox:

- Allow `staging.autoscape.ca` and `api-staging.autoscape.ca` on restricted browser/static tokens.
- Keep the browser token in frontend build envs and the static image token in API runtime envs.

Resend:

- Use a staging-safe API key/sender until production launch.
- Before production launch, smoke-test approved quote email delivery/resend plus `https://api-staging.autoscape.ca/api/approved-quote-preview/:token` with a real verified quote. Approval should remain successful even if email delivery fails, and the admin editor should show the latest delivery error plus manual resend.

Stripe:

- Use the Autoscape sandbox/test account for staging.
- Set `STRIPE_SECRET_KEY` on the `api` service from the Stripe Dashboard API keys page. Use a test secret key for staging and a live secret key only for production.
- Set `STRIPE_WEBHOOK_SECRET` on the `api` service from the Stripe webhook endpoint signing secret. Staging uses webhook destination `we_1TSTjbFOk9B0ar2ot9otfd2x`, and both staging Stripe secrets have been applied in DigitalOcean.
- The webhook endpoint URL should be `https://api-staging.autoscape.ca/api/stripe/webhook` for staging and `https://api.autoscape.ca/api/stripe/webhook` for production.
- The code uses hosted Checkout with inline prices, so no Stripe Product or Price records are required for v1.
- Keep payment methods, receipts, retry/dunning behavior, branding, and live-account activation configured in Stripe Dashboard before launch.

DNS:

- Current setup keeps DNS at GoDaddy and uses App Platform self-managed domain records.
- For staging, add CNAME records for `staging`, `api-staging`, and `admin-staging` pointing to the staging default ingress.
- Do not change registrar nameservers or remove email/authentication records unless the full zone has first been copied into DigitalOcean DNS.
- Do not switch production DNS until staging has passed smoke tests.

## 7) Staging Smoke Test

Run this after every staging deployment that touches API, auth, quote flow, admin, email, pricing, geometry, or deployment config:

```bash
curl -fsS https://api-staging.autoscape.ca/api/health
```

Manual checks:

- `https://staging.autoscape.ca` loads and deep links survive refresh.
- `https://admin-staging.autoscape.ca` loads and deep links survive refresh.
- Browser network calls use `https://api-staging.autoscape.ca`, never `localhost`.
- Address autocomplete and service-area gate work.
- Map centers from the selected address.
- Draw, edit, undo, delete, and clear-all controls work.
- Quote review creates a draft and shows a quote ID.
- Draft quote persists after an API redeploy.
- Clerk sign-in and required-phone gate work.
- Dashboard quote list/detail loads for the owner.
- Admin quote inbox/editor loads with Clerk bearer auth.
- Admin version submit verifies the quote, sets the customer status to awaiting payment, and records an approved-quote email delivery attempt.
- Approval email resend works for a verified quote and the preview image URL is publicly reachable without exposing the Mapbox token.
- CSV/admin list endpoints work for allowed roles.
- CORS allows only the configured public/admin origins.

## 8) Production Operations

Production has been created. Reuse this checklist when auditing, recreating, or changing the production deployment after staging passes the smoke test.

1. Create the production app from `.do/app.production.yaml`, or mirror it manually.
2. Confirm:
   - app name: `autoscape-production`
   - branch: `main`
   - auto-deploy: enabled
   - app/database region matches production database
   - `api` uses the larger `apps-s-1vcpu-1gb` instance from the template
3. Add production domains:
   - `autoscape.ca`
   - `www.autoscape.ca`
   - `api.autoscape.ca`
   - `admin.autoscape.ca`
4. Use production Clerk, Mapbox, Resend, and database values.
5. Let production deploy from `main`; trigger a manual deploy only if DigitalOcean does not start one after app creation or after a required env/DNS change.

Production API runtime env differences:

```text
DATABASE_URL=<production managed postgres url or ${autoscape-production-db.DATABASE_URL}>
CLIENT_ORIGIN=https://autoscape.ca,https://www.autoscape.ca,https://admin.autoscape.ca
PUBLIC_APP_BASE_URL=https://autoscape.ca
PUBLIC_API_BASE_URL=https://api.autoscape.ca
SERVICE_AREA_REGIONS=Vaughan, Ontario
AUTOSCAPE_BASE_STATIONS_JSON=<production service-area stations JSON>
CLERK_SECRET_KEY=<production Clerk secret key>
CLERK_JWT_ISSUER=<production Clerk issuer>
CLERK_ADMIN_ORG_ID=<production Clerk admin org id>
RESEND_API_KEY=<production Resend key>
MAPBOX_STATIC_ACCESS_TOKEN=<production static Mapbox token>
STRIPE_SECRET_KEY=<production Stripe live secret key>
STRIPE_WEBHOOK_SECRET=<production Stripe webhook signing secret>
```

Production frontend build env differences:

```text
public-web VITE_API_BASE_URL=https://api.autoscape.ca
public-web VITE_MAPBOX_TOKEN=<production public browser token>
public-web VITE_CLERK_PUBLISHABLE_KEY=<production Clerk publishable key>
admin-web VITE_API_BASE_URL=https://api.autoscape.ca
admin-web VITE_PUBLIC_APP_BASE_URL=https://autoscape.ca
admin-web VITE_MAPBOX_TOKEN=<production admin browser token>
admin-web VITE_CLERK_PUBLISHABLE_KEY=<production Clerk publishable key>
admin-web VITE_CLERK_ADMIN_ORG_ID=<production Clerk admin org id>
```

Run the staging smoke test again against production domains before sending real traffic.

## 9) Rollback

If staging fails:

1. Stop promoting the commit to `main`.
2. In DigitalOcean, open the staging app Deployments tab.
3. Redeploy the previous successful deployment.
4. If a Prisma migration already ran and changed schema/data, do not guess a rollback. Add a forward-fix migration and test it on staging.

If production fails:

1. Disable any marketing/launch traffic first if possible.
2. Redeploy the previous successful production deployment.
3. Check API logs and database migration status.
4. If the failure involves schema, pricing, geometry validation, auth, or quote data, fix forward through staging before another production deploy.

## 10) Operational Rules

- Never run production without `DATABASE_URL`; the in-memory fallback is local/dev only.
- Never commit `.env` files or secret-filled `.do/*.local.yaml` / `.do/*.secret.yaml` files.
- Review pricing constants, geometry validation, auth, migrations, and deployment scripts explicitly before promotion.
- Keep `README.md`, `project_context.md`, `docs/architecture.md`, `docs/feature_flow.md`, `docs/design.md`, and this file in sync when deployment behavior changes.
