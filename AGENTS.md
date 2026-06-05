# okaybabe-gradient-pack — AGENTS.md

> Agent operating instructions for Cursor + Codex (and any other coding agent working on this repo).

## What This Is

`okaybabe-gradient-pack` ships a free gradient + shader pack at `okaybabe.com/gradients`. 64 okaybabe-original assets (41 gradients + 10 procedural textures + 13 GLSL shaders), MIT-licensed.

## Tech Stack

TypeScript strict + Node 24 + pnpm. Core deps: `sharp`, `culori`, `ml-kmeans`, `tsx`. No bundler/runtime framework — scripts execute directly via `tsx`.

## Key Commands

```bash
nvm use         # Node 24 — DO NOT skip; sharp/native module compat
pnpm install
pnpm extract:dry
pnpm extract
pnpm build:packs
pnpm typecheck
```

## Project Structure

```
scripts/  — TS executables (extract-colors, build-packs, etc.)
data/     — JSON: candidates, curated, procedural recipes, shader metadata
src/      — React component wrappers for shaders (react-three-fiber)
dist/     — generated pack outputs (gitignored except manifest.json)
```

## Critical Rules

- OKLCH-first color math (perceptually uniform, hue-verified to hex)
- Deterministic: seed=42, no `Date.now()`, sorted keys
- Surface Supply pixels NEVER ship in pack output — only extracted colors with provenance
- Pack output is MIT — no attribution required, free commercial use
- Don't re-introduce MIT third-party gradient data (uiGradients/WebGradients) — pack is 100% okaybabe-original

## Per-PR deliverables

Keep the pack deterministic and the generated assets in sync — run `pnpm build:readme` (and `pnpm build:packs` when data changes) before opening a PR. This is a static pack; there is no runtime service to deploy.

## What NOT to do

- Don't embed Surface Supply JPGs in pack outputs
- Don't auto-name gradients via LLM
- Don't drift from OKLCH-verified hex values
- Don't break determinism (`Date.now()`, unsorted keys, unstable file enumeration)
