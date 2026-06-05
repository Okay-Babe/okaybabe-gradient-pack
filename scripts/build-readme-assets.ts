#!/usr/bin/env tsx
/**
 * build-readme-assets.ts
 *
 * Renders the SVG assets the README embeds to showcase the full pack.
 *
 * Outputs (light + dark variants of each):
 *   docs/assets/banner-{light,dark}.svg               — wide hero (1200×280)
 *   docs/assets/series-{aperture,surface,studio,vapor,ink}-{light,dark}.svg
 *                                                     — per-series swatch grids
 *   docs/assets/procedural-{light,dark}.svg           — 10-filter showcase grid
 *
 * Reads data/okaybabe-custom.json (multi-series schema) + data/procedural-textures.json.
 * Deterministic: same JSON in → same SVG out.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

interface ColorStop { color: string; pos: number; }
interface Gradient {
  id: string;
  name: string;
  series: string;
  deg: number;
  stops: ColorStop[];
}
interface SeriesMeta {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  count: number;
  anchor: string;
}
interface Pack {
  series_index: SeriesMeta[];
  gradients: Gradient[];
}
interface ProceduralTexture {
  name: string;
  description: string;
  params: Record<string, unknown>;
  svg: string;
}
interface ProceduralPack {
  textures: Record<string, ProceduralTexture>;
}

const REPO = path.resolve(import.meta.dirname, '..');
const OUT = path.join(REPO, 'docs/assets');

const BRAND_VIOLET = '#7C3AED';
const BRAND_INDIGO = '#6366F1';
const LIGHT_BG = '#FAFAFA';
const LIGHT_FG = '#0A0A0F';
const LIGHT_BORDER = '#E5E7EB';
const LIGHT_MUTED = '#6B7280';
const DARK_BG = '#0A0A0F';
const DARK_FG = '#FAFAFA';
const DARK_BORDER = '#27272A';
const DARK_MUTED = '#9CA3AF';

type Mode = 'light' | 'dark';
const palette = (m: Mode) => m === 'light'
  ? { bg: LIGHT_BG, fg: LIGHT_FG, muted: LIGHT_MUTED, border: LIGHT_BORDER }
  : { bg: DARK_BG, fg: DARK_FG, muted: DARK_MUTED, border: DARK_BORDER };

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function gradientDef(id: string, g: Gradient): string {
  const angle = g.deg ?? 135;
  const rad = ((angle - 90) * Math.PI) / 180;
  const x1 = (0.5 - Math.cos(rad) * 0.5 * Math.SQRT2).toFixed(4);
  const y1 = (0.5 - Math.sin(rad) * 0.5 * Math.SQRT2).toFixed(4);
  const x2 = (0.5 + Math.cos(rad) * 0.5 * Math.SQRT2).toFixed(4);
  const y2 = (0.5 + Math.sin(rad) * 0.5 * Math.SQRT2).toFixed(4);
  const stops = g.stops.map(s => `<stop offset="${s.pos}%" stop-color="${s.color}"/>`).join('');
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
}

const grainFilter = `<filter id="okb-grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" stitchTiles="stitch"/>
  <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0"/>
</filter>`;

// ─── Series grid (auto-sizes by count) ─────────────────────────────────

function seriesGrid(meta: SeriesMeta, gradients: Gradient[], mode: Mode): string {
  const p = palette(mode);
  // Choose layout: 5 cols for >=5 items, else equals item count
  const cols = gradients.length >= 5 ? 5 : gradients.length;
  const rows = Math.ceil(gradients.length / cols);
  const padX = 32;
  const padY = 64;
  const cellW = 220;
  const cellH = 110;
  const gapX = 16;
  const gapY = 40;
  const labelH = 20;
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padY * 2 + rows * (cellH + gapY + labelH);

  const defs = gradients.map(g => gradientDef(`g-${g.id}`, g)).join('');

  const swatches = gradients.map((g, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padX + col * (cellW + gapX);
    const y = padY + row * (cellH + gapY + labelH);
    const labelY = y + cellH + 18;
    const stopChips = g.stops.slice(0, 3).map(s => s.color).join(' → ');
    return `<g>
      <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="8" fill="url(#g-${g.id})"/>
      <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="8" filter="url(#okb-grain)" opacity="0.5" style="mix-blend-mode:overlay"/>
      <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="8" fill="none" stroke="${p.border}" stroke-width="1"/>
      <text x="${x}" y="${labelY}" font-family="system-ui,-apple-system,Inter,sans-serif" font-size="13" font-weight="600" fill="${p.fg}">${escape(g.name)}</text>
      <text x="${x}" y="${labelY + 16}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="10" fill="${p.muted}">${escape(stopChips)}</text>
    </g>`;
  }).join('');

  const headerY = padY - 24;
  const subtitle = `${gradients.length} gradients · ${escape(meta.description)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escape(meta.name)} — ${escape(meta.subtitle)}">
  <defs>${defs}${grainFilter}</defs>
  <rect width="${width}" height="${height}" fill="${p.bg}"/>
  <text x="${padX}" y="${headerY}" font-family="system-ui,-apple-system,Inter,sans-serif" font-size="22" font-weight="700" fill="${p.fg}">${escape(meta.name)} — ${escape(meta.subtitle)}</text>
  <text x="${padX}" y="${headerY + 22}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="11" fill="${p.muted}">${subtitle}</text>
  ${swatches}
</svg>`;
}

// ─── Procedural texture showcase ───────────────────────────────────────

function proceduralShowcase(pack: ProceduralPack, mode: Mode): string {
  const p = palette(mode);
  const entries = Object.entries(pack.textures);
  const cols = 5;
  const rows = Math.ceil(entries.length / cols);
  const padX = 32;
  const padY = 64;
  const cellW = 220;
  const cellH = 110;
  const gapX = 16;
  const gapY = 40;
  const labelH = 20;
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padY * 2 + rows * (cellH + gapY + labelH);

  // For each filter, rewrite its filter id to be unique per cell so they don't collide
  const filterDefs: string[] = [];
  const swatches: string[] = [];

  // Sample backdrop: brand-violet flat for cool contrast
  entries.forEach(([key, tex], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padX + col * (cellW + gapX);
    const y = padY + row * (cellH + gapY + labelH);
    const labelY = y + cellH + 18;
    const filterId = `proc-${key}`;
    // Rewrite the filter's id (the textures.json filter SVG has the okb-prefixed id baked in)
    const filterSvg = tex.svg.replace(/id='[^']*'/, `id='${filterId}'`).replace(/id="[^"]*"/, `id="${filterId}"`);
    filterDefs.push(filterSvg);
    swatches.push(`<g>
      <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="8" fill="${BRAND_VIOLET}"/>
      <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="8" filter="url(#${filterId})" style="mix-blend-mode:overlay"/>
      <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="8" fill="none" stroke="${p.border}" stroke-width="1"/>
      <text x="${x}" y="${labelY}" font-family="system-ui,-apple-system,Inter,sans-serif" font-size="13" font-weight="600" fill="${p.fg}">${escape(tex.name)}</text>
      <text x="${x}" y="${labelY + 16}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="10" fill="${p.muted}">${escape(key)}</text>
    </g>`);
  });

  const headerY = padY - 24;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Procedural texture filters — 10 SVG recipes">
  <defs>${filterDefs.join('')}</defs>
  <rect width="${width}" height="${height}" fill="${p.bg}"/>
  <text x="${padX}" y="${headerY}" font-family="system-ui,-apple-system,Inter,sans-serif" font-size="22" font-weight="700" fill="${p.fg}">Procedural Textures — 10 SVG Filters</text>
  <text x="${padX}" y="${headerY + 22}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="11" fill="${p.muted}">Each shown over brand-violet #7C3AED · drop over any gradient or element</text>
  ${swatches.join('')}
</svg>`;
}

// ─── Banner ────────────────────────────────────────────────────────────

function banner(pack: Pack, mode: Mode): string {
  const p = palette(mode);
  const w = 1200;
  const h = 280;

  // 6 hero gradients across the series spectrum
  const heroPicks = ['ap-refraction', 'ap-aurora', 'ss-russet', 'st-dusk', 'vp-mist', 'ik-crash'];
  const heroes = heroPicks
    .map(id => pack.gradients.find(g => g.id === id))
    .filter((g): g is Gradient => g != null);

  const defs = heroes.map(g => gradientDef(`b-${g.id}`, g)).join('') + `
    <linearGradient id="b-aperture" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND_INDIGO}"/>
      <stop offset="100%" stop-color="${BRAND_VIOLET}"/>
    </linearGradient>
    <filter id="b-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0"/>
    </filter>`;

  const stripeW = w / heroes.length;
  const stripes = heroes.map((g, i) => `
    <rect x="${i * stripeW}" y="0" width="${stripeW}" height="${h}" fill="url(#b-${g.id})"/>
    <rect x="${i * stripeW}" y="0" width="${stripeW}" height="${h}" filter="url(#b-grain)" opacity="0.5" style="mix-blend-mode:overlay"/>
  `).join('');

  const titleBg = mode === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(10,10,15,0.88)';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="okaybabe gradient pack">
  <defs>${defs}</defs>
  ${stripes}
  <rect x="160" y="80" width="${w - 320}" height="120" rx="12" fill="${titleBg}"/>
  <circle cx="228" cy="140" r="26" fill="url(#b-aperture)"/>
  <text x="276" y="132" font-family="system-ui,-apple-system,Inter,sans-serif" font-size="28" font-weight="700" fill="${p.fg}">okaybabe gradient pack</text>
  <text x="276" y="160" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="13" fill="${p.muted}">63 free original gradients · textures · GLSL shaders · MIT</text>
</svg>`;
}

// ─── Driver ────────────────────────────────────────────────────────────

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const pack = JSON.parse(await fs.readFile(path.join(REPO, 'data/okaybabe-custom.json'), 'utf8')) as Pack;
  const proc = JSON.parse(await fs.readFile(path.join(REPO, 'data/procedural-textures.json'), 'utf8')) as ProceduralPack;

  const writes: [string, string][] = [];

  // Banner
  for (const mode of ['light', 'dark'] as const) {
    writes.push([`banner-${mode}.svg`, banner(pack, mode)]);
  }

  // Per-series grids
  for (const meta of pack.series_index) {
    const seriesGradients = pack.gradients.filter(g => g.series === meta.id);
    if (seriesGradients.length === 0) continue;
    for (const mode of ['light', 'dark'] as const) {
      writes.push([`series-${meta.id}-${mode}.svg`, seriesGrid(meta, seriesGradients, mode)]);
    }
  }

  // Procedural showcase
  for (const mode of ['light', 'dark'] as const) {
    writes.push([`procedural-${mode}.svg`, proceduralShowcase(proc, mode)]);
  }

  for (const [name, content] of writes) {
    await fs.writeFile(path.join(OUT, name), content);
    console.log(`✓ ${path.join('docs/assets', name)} (${content.length.toLocaleString()} bytes)`);
  }

  console.log(`\n✓ Generated ${writes.length} SVG assets`);
  // Backwards-compat alias for the existing surface-grid filenames (README v1)
  await fs.copyFile(path.join(OUT, 'series-surface-light.svg'), path.join(OUT, 'surface-grid-light.svg'));
  await fs.copyFile(path.join(OUT, 'series-surface-dark.svg'), path.join(OUT, 'surface-grid-dark.svg'));
  console.log(`✓ Maintained surface-grid-{light,dark}.svg alias for backwards compat`);
}

main().catch(err => {
  console.error(`💥 ${err.message}`);
  process.exit(1);
});
