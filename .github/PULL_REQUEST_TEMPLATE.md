## What this changes

<!-- 1-3 sentences on what the PR does and why -->

## Checklist

- [ ] `deployment.md` updated if env vars / dependencies / migrations changed
- [ ] `pnpm typecheck` passes
- [ ] Pack output is deterministic (`seed=42`, sorted keys, no `Date.now()`)
- [ ] OKLCH literals round-trip to claimed hex (per `culori` CI guard)
- [ ] Surface Supply pixels NOT embedded in pack output (only extracted colors with provenance)
- [ ] License posture unchanged (MIT, no attribution required)
