# Archived: Autonomous-mowing homepage

This folder is a **verbatim, inert snapshot** of the homepage as it was *before* the
"generic landscaping" redesign (the version that openly featured autonomous robot
lawnmowers).

It is kept so individual sections can be brought back later if the market strategy
changes again.

## Important: this code is inert

- It lives in `client/archive/`, **outside `client/src`**, so it is **not** type-checked
  (`tsconfig.json` only includes `src`), **not** linted, **not** bundled by Vite, and
  **not** routed. Real users can never see it.
- Nothing imports from this folder. It is reference-only.
- These files were taken straight from the git commit that the redesign branch was cut
  from, so they are guaranteed to be the exact pre-redesign code.

## Contents

```
HomePage.tsx                              ← autonomous homepage (hero + Services + FAQ inline)
HomePage.test.tsx                         ← the matching pre-redesign tests
components/home/HomeMowerActionSection.tsx← "In Action" autonomous-mower video section
components/home/HomeLawnmowersSection.tsx ← "Meet our lawnmowers" robot-spec section
components/home/HomeHeroLawnGraphic.tsx   ← the animated robot-mower hero SVG
lib/homeHeroLawn.ts                       ← data/maths for the hero animation
lib/homeHeroLawnCoverage.ts               ← data/maths for the hero animation
```

The paths under this folder mirror their original location under `client/src/`, so
restoring is a straight copy back.

> Note: `HomeHeroLawnGraphic.tsx`, `lib/homeHeroLawn.ts` and `lib/homeHeroLawnCoverage.ts`
> are still present in `client/src` today (just unused). A separate cleanup task may delete
> them from `src`. Copies are kept here so a restore still works even after that cleanup.

## What changed in the live redesign

Live homepage = `client/src/pages/HomePage.tsx`. Section by section:

| Section | Autonomous (archived) | Live now (generic) |
|---|---|---|
| Hero | `HomeHeroLawnGraphic` robot animation + "Autonomous Landscaping Service" | tagline "A Lawn You'll Love, Effortlessly" + before/after photo |
| Pricing | "Save with Autoscape" | **unchanged** (not archived — still live) |
| `HomeMowerActionSection` | "In Action" + autonomous-mower video | "Real Results" + before/after photo |
| `HomeLawnmowersSection` | "Meet our lawnmowers" + robot specs/render | "Why homeowners choose Autoscape" + value props |
| Services card (inline) | "Autonomous Mowing" card + description | "Weekly Mowing" |
| FAQ (inline) | autonomous-worded questions | generic questions |

## How to bring a section back

Run paths from the repo root.

### A whole component section (`HomeMowerActionSection` or `HomeLawnmowersSection`)

```sh
cp client/archive/autonomous-homepage/components/home/HomeMowerActionSection.tsx \
   client/src/components/home/HomeMowerActionSection.tsx
# or HomeLawnmowersSection.tsx
```

That single copy restores that section as-is (it is still imported by `HomePage.tsx`).

### The autonomous hero, Services card, or FAQ (these live inline in `HomePage.tsx`)

Open `client/archive/autonomous-homepage/HomePage.tsx`, copy just the JSX block you
want (the hero `<section>`, the Services card, or the relevant `faqs` entries) into
`client/src/pages/HomePage.tsx`.

If you restore the **autonomous hero**, it imports `HomeHeroLawnGraphic`. Ensure these
exist in `src` (restore from this archive if the cleanup task removed them):

```sh
cp client/archive/autonomous-homepage/components/home/HomeHeroLawnGraphic.tsx client/src/components/home/
cp client/archive/autonomous-homepage/lib/homeHeroLawn.ts                     client/src/lib/
cp client/archive/autonomous-homepage/lib/homeHeroLawnCoverage.ts             client/src/lib/
```

### Restore the entire autonomous homepage

```sh
cp client/archive/autonomous-homepage/HomePage.tsx              client/src/pages/HomePage.tsx
cp client/archive/autonomous-homepage/HomePage.test.tsx         client/src/pages/HomePage.test.tsx
cp client/archive/autonomous-homepage/components/home/HomeMowerActionSection.tsx client/src/components/home/
cp client/archive/autonomous-homepage/components/home/HomeLawnmowersSection.tsx  client/src/components/home/
cp client/archive/autonomous-homepage/components/home/HomeHeroLawnGraphic.tsx    client/src/components/home/
cp client/archive/autonomous-homepage/lib/homeHeroLawn.ts                        client/src/lib/
cp client/archive/autonomous-homepage/lib/homeHeroLawnCoverage.ts               client/src/lib/
```

After any restore, update `client/src/pages/HomePage.test.tsx` to match whatever final
mix of sections you ship, then run `npm --prefix client run lint` and
`cd client && npx vitest run`.

The original autonomous-mower image/video assets were never deleted; they still live in
`client/public/images/home/` and `client/public/videos/home/`.
```
