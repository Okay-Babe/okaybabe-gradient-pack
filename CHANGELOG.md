# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-05-23

### Added

- **41 hand-curated gradients** across 5 named series:
  - **Aperture (6)** — prismatic brand anchor: Refraction · Spectrum · Iris · Aurora · Halo · Crown
  - **Surface (19)** — paper-tones library extracted via OKLCH k-means from owned analog textures, organized across 5 tonal tiers: Earth · Champagne · Paper · Textile · Cool
  - **Studio (6)** — distilled from real okaybabe studio engagements: Dusk · Mascot · Caravan · Outpost · Forge · Cohort
  - **Vapor (5)** — soft pastel originals: Mist · Haze · Veil · Lull · Drift
  - **Ink (5)** — high-contrast editorial duo-tones: Sumi · Reverb · Crash · Cipher · Strobe
- **10 procedural SVG `<feTurbulence>` texture filters**: grain-fine · oil-slick · risograph · halftone · chrome-warp · vapor · ink-bleed · noise-coarse · scan-lines · paper-fiber
- **13 hand-coded GLSL fragment shaders** shipped via the companion npm package [`@okaybabe/shaders`](https://github.com/Okay-Babe/okaybabe-shaders): Aperture Bloom · Halation · Quarry · Ink Run · Optic · Foxglove · Prism Stop · Twilight Run · Vellum · Sirocco · Hessian · Chroma Bleed · Membrane
- **7 download formats**:
  - Sketch master (`.sketch`) — Shared Layer Styles per gradient
  - Figma Community — Fill Styles per gradient
  - CSS — `.gradient-{slug}` classes
  - SCSS — `$gradient-{slug}` variables + mixins
  - JSON — unified schema
  - Tailwind v4 — `@theme` block with custom utilities
  - Shaders ZIP — GLSL source + R3F wrappers + MP4 previews
- MP4 shader previews color-graded in DaVinci Resolve and hosted at `previews.okaybabe.dev/v1/{shader}-{tier}.mp4` (1080p · 1080sq · 720p · 540sq + poster JPG per shader)
- Per-gradient provenance recorded (`sourceFile`, `extraction` block, OKLCH-verified hex)

### License

MIT. Free for personal and commercial use. No attribution required.

### Built by

[the okaybabe studio](https://okaybabe.com) — the design studio that ships end-to-end.

[Unreleased]: https://github.com/Okay-Babe/okaybabe-gradient-pack/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Okay-Babe/okaybabe-gradient-pack/releases/tag/v1.0.0
