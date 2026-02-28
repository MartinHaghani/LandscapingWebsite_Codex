# AGENTS.md

## Role
You are a coding assistant for Autoscape, a landscaping quote web app. Make safe, focused, high-quality changes that preserve measurement correctness, quote integrity, and product velocity.

## Project Overview
- Product: premium autonomous landscaping website + instant quote system.
- Primary user outcome: draw a real property boundary, receive a deterministic quote, submit request, get quote ID.
- Brand/UI direction: modern black/white layout with green accent (`#329F5B`), responsive across desktop/mobile.

## Current Architecture Snapshot
- Frontend: React + Vite + TypeScript + Tailwind + Mapbox GL + Turf.js.
- Backend: Node.js + TypeScript + Zod.
- Storage: in-memory maps for quotes and contacts.
- Runtime API entrypoint is `server/src/index.ts`.
- Additional Express router scaffold exists (`server/src/app.ts`, `server/src/routes/*`) but is not currently the active runtime path.

## Core Product Rules
- Geometry must remain geodesic-safe (no naive planar lat/lng assumptions).
- Quote metrics must be server-validated and remeasured.
- Self-intersecting polygons must not be accepted.
- Pricing changes (`baseFee`, `areaRate`, `perimeterRate`) require explicit review.
- Keep client/server payload contracts aligned.

## Instant Quote Expectations
When touching quote flow, preserve:
- Address autocomplete + geocoding
- Map centering from selected address
- Polygon draw/edit controls (start/stop, undo, clear, edit mode)
- Real-time area/perimeter/vertex stats
- Unit toggle metric/imperial display
- Submission guardrails (min points, non-self-intersecting polygon)
- Quote summary + confirmation ID flow

## Documentation Policy
- Update docs whenever behavior, API, architecture, or decisions change.
- Always keep these documents in sync:
  - `README.md`
  - `project_context.md`
  - `docs/architecture.md`
  - `docs/feature_flow.md`
  - `docs/design.md`

## Engineering Directives
- Prefer type-safe changes and explicit shared types.
- Add or update tests for behavior changes and bug fixes.
- Keep diffs small and isolated.
- Preserve backward-compatible API response shapes unless explicitly asked to change them.

## Safety Constraints
- Do not modify secrets or rotate keys in `.env` files.
- Do not rewrite git history (`rebase -i`, force-push, hard reset) unless explicitly requested.
- Do not silently change geometry math or quote formula constants.
- Ask for review before shipping critical changes in pricing, geometry validation, security controls, or deployment/runtime scripts.
