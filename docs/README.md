# Documentation Index

- [`../project_context.md`](../project_context.md): product purpose, implemented capabilities, quote pipeline, data model, and operational notes.
- [`architecture.md`](./architecture.md): system boundaries, runtime components, API and geometry validation path.
- [`feature_flow.md`](./feature_flow.md): user journeys for Instant Quote and Contact, including edge-case handling.
- [`design.md`](./design.md): design decisions and rationale (accuracy, pricing, storage, validation model).
- [`deployment.md`](./deployment.md): DigitalOcean staging/production setup, current live status, env vars, DNS, smoke tests, and rollback.
- [`legal_evidence_report.md`](./legal_evidence_report.md): legal document paths, codebase evidence, third-party/data-flow findings, and owner/attorney review items.
- [`coding_standards.md`](./coding_standards.md): TypeScript, linting, formatting, test, and doc-update expectations.
- [`changelog.md`](./changelog.md): commit history snapshot generated from git log.
- [`troubleshooting.md`](./troubleshooting.md): runbook for local port drift, stale frontend servers, and verification steps.

Current deployment note: staging is active and authenticated quote/admin smoke tests pass through redeploy persistence, but production remains blocked until the approval-email resend and approved-quote preview API gap is resolved or removed from launch scope.
