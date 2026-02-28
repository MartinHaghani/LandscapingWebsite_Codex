# Contributing

## Development Workflow
1. Create a focused branch from the latest default branch.
2. Keep changes scoped to one concern per commit.
3. Run local checks before opening a PR:
   - `npm run lint`
   - `npm run build`
   - `npm test`
4. Update docs and tests alongside code changes.

## Small-Commit Practice
- Prefer small, reviewable commits over large batches.
- Each commit should answer one question: "what behavior changed and why?"
- Separate refactors from feature work when possible.

## Commit Message Guidelines
- Use descriptive, scoped messages.
- Recommended style: `<type>(<scope>): <summary>`
- Examples:
  - `feat(quote): add geodesic perimeter normalization`
  - `fix(api): reject invalid polygon rings`
  - `docs(feature-flow): clarify unit-toggle behavior`

## Pull Request Requirements
- Include a concise problem statement and solution summary.
- Link relevant issues or context when available.
- Document risk areas (pricing, geometry, API contracts, security).
- Confirm docs and tests were updated when behavior changed.
- PRs that touch critical logic require at least one reviewer approval before merge.

## Code Review Expectations
- Reviewers should prioritize correctness, regressions, and edge cases.
- Critical changes should include explicit notes on rollback strategy.
- If a PR changes architecture, include or update `docs/architecture.md`.
