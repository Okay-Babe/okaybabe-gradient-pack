#!/usr/bin/env tsx
/**
 * extract-colors.ts
 *
 * Saliency-weighted k-means color extraction in OKLCH space.
 * Input: directory of JPGs (default: Surface Supply 86 textures).
 * Output: JSON file of candidate gradients with provenance.
 *
 * Algorithm:
 *   1. Sharp pre-blur (radius 1.0) to kill JPEG compression artifacts
 *   2. Sharp resize to 256px longest edge (working set ≈ 200KB per image)
 *   3. Convert every non-monotone pixel to OKLAB (perceptually uniform)
 *   4. Weight each sample by saliency = chroma × (1 - |L - 0.5|)
 *      (punishes blown highlights AND crushed shadows)
 *   5. k-means (k=5, seed=42, kmeans++ init) over weighted OKLAB samples
 *   6. Sort centroids by luminance, emit as 5-stop gradient (positions 0/25/50/75/100)
 *   7. Reject if: mean chroma < 0.04 OR stddev L < 0.08 OR top cluster > 70% of weight
 *
 * Provenance: every output entry records source file + license posture.
 * Surface Supply pixels are NOT redistributed; extracted color values ARE legal.
 *
 * License: this script is MIT.
 * Pack output: also MIT.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { converter, formatHex } from 'culori';
import { kmeans } from 'ml-kmeans';

// ─── Types ────────────────────────────────────────────────────────────────

interface ColorStop {
  color: string; // 6-digit lowercased hex
  pos: number;   // 0..100 integer
}

interface CandidateGradient {
  id: string;
  name: string;
  source: 'surface-supply';
  sourceFile: string;
  license: 'okaybabe-proprietary'; // colors not copyrightable; provenance tracked
  deg: number;
  type: 'linear';
  stops: ColorStop[];
  tags: string[];          // auto-tagged: warm/cool/pastel/vibrant/dark/neutral
  meanChroma: number;      // for QA + audit
  stddevL: number;         // for QA + audit
  topClusterWeight: number;// for QA + audit
  createdAt: string;
}

interface ExtractionResult {
  kept: CandidateGradient[];
  rejected: Array<{ sourceFile: string; reason: string; meanChroma: number; stddevL: number; topClusterWeight: number }>;
}

// ─── CLI ──────────────────────────────────────────────────────────────────

interface Cli {
  inputDir: string;
  outputFile: string;
  rejectsFile: string;
  k: number;
  dryRun: boolean;
  verbose: boolean;
}

function parseCli(argv: string[]): Cli {
  const home = process.env.HOME;
  if (!home) {
    throw new Error(
      'HOME env var required to locate Surface Supply input directory. Pass --input <path> to override.'
    );
  }
  const DEFAULT_INPUT = path.resolve(
    home,
    'Desktop/OKB Design Studio/Design Resources/Studio Textures/Surface Supply'
  );
  const cli: Cli = {
    inputDir: DEFAULT_INPUT,
    outputFile: 'data/okaybabe-custom-candidates.json',
    rejectsFile: 'data/okaybabe-custom-rejects.json',
    k: 5,
    dryRun: false,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--input' && next) { cli.inputDir = next; i++; }
    else if (arg === '--output' && next) { cli.outputFile = next; i++; }
    else if (arg === '--rejects' && next) { cli.rejectsFile = next; i++; }
    else if (arg === '--k' && next) { cli.k = Number(next); i++; }
    else if (arg === '--dry-run') cli.dryRun = true;
    else if (arg === '--verbose' || arg === '-v') cli.verbose = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: extract-colors [opts]
  --input <dir>      Source JPG directory (default: Surface Supply path)
  --output <file>    Output JSON (default: data/okaybabe-custom-candidates.json)
  --rejects <file>   Rejected-images log (default: data/okaybabe-custom-rejects.json)
  --k <n>            Stops per gradient (default: 5)
  --dry-run          Don't write files; print summary
  --verbose          Per-file progress`);
      process.exit(0);
    }
  }
  return cli;
}

// ─── Color science helpers ───────────────────────────────────────────────

const toOklab = converter('oklab');

interface OklabSample { l: number; a: number; b: number; weight: number; }

function pixelToOklab(r: number, g: number, b: number): OklabSample | null {
  const c = toOklab({ mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 });
  if (c == null || c.l == null || c.a == null || c.b == null) return null;

  // Chroma in lab = sqrt(a² + b²)
  const chroma = Math.hypot(c.a, c.b);
  // Tuned 2026-05-21 for Surface Supply (paper/canvas textures with subtle tonal variation, not vivid color samples)
  if (chroma < 0.003) return null; // truly grayscale; keep subtle tonal pixels

  // Saliency weight: chroma × (1 - |L - 0.5|)
  // punishes blown highlights (L→1) AND crushed shadows (L→0)
  const weight = chroma * (1 - Math.abs(c.l - 0.5));
  return { l: c.l, a: c.a, b: c.b, weight };
}

function oklabToHex(l: number, a: number, b: number): string {
  return formatHex({ mode: 'oklab', l, a, b }).toLowerCase();
}

// ─── Stats ────────────────────────────────────────────────────────────────

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

// ─── Naming + tagging ────────────────────────────────────────────────────

function slugFromFilename(filename: string): string {
  return filename
    .replace(/\.(jpe?g|png|webp)$/i, '')
    .replace(/foxrockettstudio\s*-\s*/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

function autoTags(stops: ColorStop[], meanL: number, meanC: number): string[] {
  const tags: string[] = [];
  // Determine warm/cool by average hue
  let hueSum = 0, count = 0;
  for (const s of stops) {
    const m = s.color.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
    if (!m) continue;
    const r = parseInt(m[1], 16) / 255;
    const g = parseInt(m[2], 16) / 255;
    const b = parseInt(m[3], 16) / 255;
    // Crude warm/cool: red+yellow vs blue+green
    const warm = (r + (g * 0.5)) - (b + (g * 0.3));
    hueSum += warm;
    count++;
  }
  const avgWarm = count > 0 ? hueSum / count : 0;
  if (avgWarm > 0.1) tags.push('warm');
  else if (avgWarm < -0.1) tags.push('cool');
  else tags.push('neutral');

  if (meanL < 0.35) tags.push('dark');
  if (meanC < 0.08) tags.push('pastel');
  if (meanC > 0.18) tags.push('vibrant');

  return tags;
}

// ─── Extraction core ─────────────────────────────────────────────────────

interface ExtractOpts { k: number; verbose: boolean; }

async function extractFromImage(filePath: string, opts: ExtractOpts): Promise<CandidateGradient | { rejected: true; reason: string; meanChroma: number; stddevL: number; topClusterWeight: number; sourceFile: string }> {
  const filename = path.basename(filePath);

  // 1. Pre-blur + downsample
  let raw: { data: Buffer; info: sharp.OutputInfo };
  try {
    raw = await sharp(filePath)
      .blur(1.0)
      .resize(256, 256, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
      .raw()
      .removeAlpha()
      .toBuffer({ resolveWithObject: true });
  } catch (err) {
    throw new Error(`Failed to read ${filename}: ${(err as Error).message}`);
  }

  // 2. Convert pixels to saliency-weighted OKLAB samples
  const samples: OklabSample[] = [];
  for (let i = 0; i < raw.data.length; i += 3) {
    const sample = pixelToOklab(raw.data[i], raw.data[i + 1], raw.data[i + 2]);
    if (sample !== null) samples.push(sample);
  }
  if (samples.length < 100) {
    return { rejected: true, reason: 'Too few non-grayscale pixels', meanChroma: 0, stddevL: 0, topClusterWeight: 1, sourceFile: filename };
  }

  // 3. k-means in OKLAB 3-space (seed=42 for determinism)
  const matrix = samples.map(s => [s.l, s.a, s.b]);
  const weights = samples.map(s => s.weight);
  const result = kmeans(matrix, opts.k, {
    initialization: 'kmeans++',
    seed: 42,
    maxIterations: 100,
  });
  const centroids: number[][] = result.centroids;
  const clusters: number[] = result.clusters;

  // 4. Compute per-cluster weight + stats
  const clusterWeight = new Array<number>(opts.k).fill(0);
  for (let i = 0; i < clusters.length; i++) {
    clusterWeight[clusters[i]] += weights[i];
  }
  const totalWeight = clusterWeight.reduce((s, w) => s + w, 0) || 1;
  const topClusterWeight = Math.max(...clusterWeight) / totalWeight;

  const luminances = samples.map(s => s.l);
  const chromas = samples.map(s => Math.hypot(s.a, s.b));
  const meanL = mean(luminances);
  const meanChroma = mean(chromas);
  const sdL = stddev(luminances);

  // 5. Reject criteria — TUNED 2026-05-21 for Surface Supply (paper/canvas textures, subtle tonal variation)
  //    Original thresholds (0.04 / 0.08 / 0.7) calibrated for vivid color samples; rejected 100% of Surface Supply at 0% yield.
  //    Re-tuned per p75 distribution analysis (median chroma 0.025, median stddevL 0.008).
  if (meanChroma < 0.015) return { rejected: true, reason: 'Truly monotone (mean chroma < 0.015)', meanChroma, stddevL: sdL, topClusterWeight, sourceFile: filename };
  if (sdL < 0.015) return { rejected: true, reason: 'Truly flat luminance (stddev L < 0.015)', meanChroma, stddevL: sdL, topClusterWeight, sourceFile: filename };
  if (topClusterWeight > 0.85) return { rejected: true, reason: 'Single dominant cluster (>85% weight)', meanChroma, stddevL: sdL, topClusterWeight, sourceFile: filename };

  // 6. Build stops — sort centroids by luminance, place at even positions
  const stopsRaw = centroids
    .map(c => ({ l: c[0], a: c[1], b: c[2] }))
    .sort((x, y) => x.l - y.l);

  const stops: ColorStop[] = stopsRaw.map((c, i) => ({
    color: oklabToHex(c.l, c.a, c.b),
    pos: Math.round((i / (opts.k - 1)) * 100),
  }));

  const slug = slugFromFilename(filename);
  const candidate: CandidateGradient = {
    id: `ss-${slug}`,
    name: `Surface ${slug.replace(/^surface-supply-?/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || slug}`,
    source: 'surface-supply',
    sourceFile: filename,
    license: 'okaybabe-proprietary',
    deg: 135, // diagonal — replace during curation
    type: 'linear',
    stops,
    tags: autoTags(stops, meanL, meanChroma),
    meanChroma: Number(meanChroma.toFixed(4)),
    stddevL: Number(sdL.toFixed(4)),
    topClusterWeight: Number(topClusterWeight.toFixed(4)),
    createdAt: '2026-05-21', // deterministic; do NOT use Date.now()
  };

  if (opts.verbose) {
    console.log(`✓ ${filename} → ${candidate.id} | ${stops.map(s => s.color).join(' → ')} | tags: ${candidate.tags.join(',')}`);
  }

  return candidate;
}

// ─── Driver ──────────────────────────────────────────────────────────────

async function main() {
  const cli = parseCli(process.argv.slice(2));

  console.log(`🎨 extract-colors.ts — okaybabe gradient pack candidate extraction`);
  console.log(`   Input: ${cli.inputDir}`);
  console.log(`   Output: ${cli.outputFile}${cli.dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`   k: ${cli.k}, seed: 42 (deterministic)\n`);

  // Discover JPGs
  let files: string[];
  try {
    files = (await fs.readdir(cli.inputDir))
      .filter(f => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith('.'))
      .sort();
  } catch (err) {
    console.error(`❌ Cannot read input dir: ${(err as Error).message}`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(`❌ No images found in ${cli.inputDir}`);
    process.exit(1);
  }
  console.log(`   Found ${files.length} images\n`);

  const result: ExtractionResult = { kept: [], rejected: [] };

  for (const file of files) {
    const filePath = path.join(cli.inputDir, file);
    try {
      const out = await extractFromImage(filePath, { k: cli.k, verbose: cli.verbose });
      if ('rejected' in out) {
        result.rejected.push({
          sourceFile: out.sourceFile,
          reason: out.reason,
          meanChroma: Number(out.meanChroma.toFixed(4)),
          stddevL: Number(out.stddevL.toFixed(4)),
          topClusterWeight: Number(out.topClusterWeight.toFixed(4)),
        });
        if (cli.verbose) console.log(`✗ ${file} → REJECTED (${out.reason})`);
      } else {
        result.kept.push(out);
      }
    } catch (err) {
      console.error(`⚠ ${file}: ${(err as Error).message}`);
    }
  }

  console.log(`\n📊 Results: ${result.kept.length} kept, ${result.rejected.length} rejected (${Math.round(100 * result.kept.length / files.length)}% yield)\n`);

  if (result.rejected.length > 0) {
    const reasonCounts = result.rejected.reduce<Record<string, number>>((acc, r) => {
      acc[r.reason] = (acc[r.reason] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`   Reject reasons:`);
    for (const [reason, count] of Object.entries(reasonCounts)) {
      console.log(`     - ${reason}: ${count}`);
    }
    console.log();
  }

  if (cli.dryRun) {
    console.log(`🔵 DRY RUN — sample kept entry:`);
    console.log(JSON.stringify(result.kept[0], null, 2));
    return;
  }

  // Ensure output dirs exist
  await fs.mkdir(path.dirname(cli.outputFile), { recursive: true });
  await fs.writeFile(cli.outputFile, JSON.stringify(result.kept, null, 2) + '\n');
  await fs.writeFile(cli.rejectsFile, JSON.stringify(result.rejected, null, 2) + '\n');

  console.log(`✓ Wrote ${result.kept.length} candidates → ${cli.outputFile}`);
  console.log(`✓ Wrote ${result.rejected.length} rejections → ${cli.rejectsFile}`);
  console.log(`\nNext: open the output JSON; eye-test each candidate; mark ~40 keepers → 8 Surface Series finalists.`);
}

main().catch(err => {
  console.error(`💥 Fatal: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
