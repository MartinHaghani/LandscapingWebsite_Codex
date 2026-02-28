# Coding Standards

## TypeScript
- TypeScript strict mode is required (`strict: true`) in:
  - `client/tsconfig.json`
  - `server/tsconfig.json`
- Prefer explicit types for shared contracts and API payloads.
- Avoid `any`; use narrow types and schema validation where needed.

## ESLint
- Repo uses a strict TypeScript ESLint configuration at the root (`.eslintrc.cjs`).
- ESLint runs as part of `npm run lint` and CI.
- Lint warnings are treated as failures (`--max-warnings=0`).

## Prettier
- Formatting is standardized with Prettier (`.prettierrc.json`).
- Use:
  - `npm run format` for write mode
  - `npm run format:check` for CI/pre-PR validation

## Documentation And Tests
- Any behavior change should include:
  - Updated or added tests.
  - Updated docs (`README.md` and/or `docs/*.md`) describing the change.
