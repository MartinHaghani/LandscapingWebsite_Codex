# DigitalOcean Deployment Runbook

Autoscape deploys to DigitalOcean App Platform as two isolated apps: staging first, production after staging passes smoke tests. Each app has three components and its own managed PostgreSQL database.

## Current Live Status (2026-04-21)

Staging is created and active in DigitalOcean:

- App: `autoscape-staging` (`658f8cc6-fda5-4d71-a436-606b887bb76e`)
- Region: App Platform `tor`; database `tor1`
- Components: `public-web`, `admin-web`, `api`, `migrate`
- Default ingress: `https://autoscape-staging-w9537.ondigitalocean.app`
- Database cluster: `autoscape-staging-db`, PostgreSQL 16, size `db-s-1vcpu-1gb`
- Database/user names: `autoscape_staging`
- Migration status: the `migrate` pre-deploy job applied all committed Prisma migrations successfully.
- Smoke-test status: partial. The default ingress loads the public static app, the API process is running, and Prisma migrations have applied.
- Production status: not created. Do not create or route production until staging custom domains resolve and smoke tests pass.

Staging custom domains are still blocked on DNS:

| Domain | DigitalOcean state | Blocker |
| --- | --- | --- |
| `staging.autoscape.ca` | `CONFIGURING` | `DomainUnexpectedNameserver` |
| `api-staging.autoscape.ca` | `CONFIGURING` | `DomainUnexpectedNameserver` |
| `admin-staging.autoscape.ca` | `CONFIGURING` | `DomainUnexpectedNameserver` |

Current public DNS for `autoscape.ca` is delegated to `ns63.domaincontrol.com` and `ns64.domaincontrol.com`. DigitalOcean is waiting for the domain to be delegated to:

```text
ns1.digitalocean.com
ns2.digitalocean.com
ns3.digitalocean.com
```

Add those nameservers at the domain registrar, or keep DNS at the current provider and manually mirror the App Platform records DigitalOcean provides there. Do not switch production traffic until the staging domains validate and the smoke test checklist passes.

Blocked smoke tests until DNS validates:

- custom-domain API health at `https://api-staging.autoscape.ca/api/health`
- quote creation and quote ID confirmation
- Clerk sign-in and admin editor
- approved quote preview URL
- quote persistence after API redeploy

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
| `AUTOSCAPE_BASE_STATIONS_JSON` | found |
| `SERVICE_AREA_REGIONS` | found |
| `SYSTEM_LAUNCH_AT` | found |
| `VITE_SYSTEM_LAUNCH_AT` | found |
| `DATABASE_URL` | DigitalOcean managed database binding only |

## 1) Deployment Topology

| Environment | Branch | App Platform app | Deploy mode | Public domains |
| --- | --- | --- | --- | --- |
| Staging | `staging` | `autoscape-staging` | auto-deploy on push | `staging.autoscape.ca`, `api-staging.autoscape.ca`, `admin-staging.autoscape.ca` |
| Production | `main` | `autoscape-production` | manual deploy | `autoscape.ca`, `www.autoscape.ca`, `api.autoscape.ca`, `admin.autoscape.ca` |

Each app contains:

| Component | Type | Source | Build | Runtime |
| --- | --- | --- | --- | --- |
| `public-web` | static site | `client/` | `npm ci && npm run build` | serves `dist` with `index.html` catch-all |
| `admin-web` | static site | `admin/` | `npm ci && npm run build` | serves `dist` with `index.html` catch-all |
| `api` | web service | `server/` | `npm ci && npm run prisma:generate && npm run build` | `npm start` |
| `migrate` | pre-deploy job | `server/` | `npm ci && npm run prisma:generate && npm run build` | `npm run prisma:migrate:deploy` |

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
feature branch -> pull request -> staging -> smoke test -> main -> manual production deploy
```

Production should stay manual until the quote/admin/email workflows are stable.

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
```

Set `DATABASE_URL` on the `migrate` job as the same staging database URL/bindable variable.

## 6) External Service Setup

Clerk:

- Use staging/dev Clerk keys for staging.
- Add allowed origins and redirect URLs for `staging.autoscape.ca` and `admin-staging.autoscape.ca`.
- Confirm `CLERK_ADMIN_ORG_ID` and `VITE_CLERK_ADMIN_ORG_ID` point to the same staging admin organization.

Mapbox:

- Allow `staging.autoscape.ca` and `api-staging.autoscape.ca` on restricted browser/static tokens.
- Keep the browser token in frontend build envs and the static image token in API runtime envs.

Resend:

- Use a staging-safe API key/sender until production launch.
- Confirm approved quote preview images load from `https://api-staging.autoscape.ca/api/approved-quote-preview/:token`.

DNS:

- Prefer DigitalOcean-managed DNS for `autoscape.ca` if possible.
- Otherwise copy the exact CNAME/A records DigitalOcean gives for each App Platform domain.
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
- Admin approve/resend flow records approved quote email status.
- Preview image URL is publicly reachable.
- CSV/admin list endpoints work for allowed roles.
- CORS allows only the configured public/admin origins.

## 8) Create Production

Only create or switch production after staging passes the smoke test.

1. Create the production app from `.do/app.production.yaml`, or mirror it manually.
2. Confirm:
   - app name: `autoscape-production`
   - branch: `main`
   - auto-deploy: disabled
   - app/database region matches production database
   - `api` uses the larger `apps-s-1vcpu-1gb` instance from the template
3. Add production domains:
   - `autoscape.ca`
   - `www.autoscape.ca`
   - `api.autoscape.ca`
   - `admin.autoscape.ca`
4. Use production Clerk, Mapbox, Resend, and database values.
5. Trigger the first production deploy manually.

Production API runtime env differences:

```text
DATABASE_URL=<production managed postgres url or ${autoscape-production-db.DATABASE_URL}>
CLIENT_ORIGIN=https://autoscape.ca,https://www.autoscape.ca,https://admin.autoscape.ca
PUBLIC_APP_BASE_URL=https://autoscape.ca
PUBLIC_API_BASE_URL=https://api.autoscape.ca
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
