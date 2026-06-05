# Contributing

Thanks for thinking about contributing to okaybabe-gradient-pack.

## How we evaluate additions

This pack is **curated** — every gradient, texture, and shader is okaybabe-original, hand-authored or extracted from owned content, and tonally coherent within its named series. We don't accept arbitrary gradient PRs.

If you have an idea for an addition we should consider:

1. Open a feature request issue describing the use case + the proposed gradient / texture / shader.
2. If it's a fit, we'll iterate on it together before any code lands.

## How we maintain quality

- **OKLCH-first color math** — perceptually uniform, hue-verified to hex.
- **Determinism** — `seed=42`, no `Date.now()`, sorted keys, hash-snapshot CI tests.
- **License integrity** — Surface Supply source pixels are never redistributed; only extracted color values, with `sourceFile` provenance recorded per gradient.
- **Voice** — count-led, hand-authored, technical. No marketing-speak.

## Local dev

See [`README.md` → Local dev](README.md#local-dev).

## License

By contributing, you agree your contribution is licensed under the MIT License of this repository.
