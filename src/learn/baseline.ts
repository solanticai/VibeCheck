import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ConventionsReport } from './aggregator.js';
import type { DiscoveredPattern } from './analyzers/types.js';

export interface BaselineSnapshot {
  frozenAt: string;
  projectRoot: string;
  patterns: DiscoveredPattern[];
}

export interface DriftReport {
  newPatterns: DiscoveredPattern[];
  vanishedPatterns: DiscoveredPattern[];
  changedConfidence: Array<{ pattern: string; was: number; now: number; delta: number }>;
  driftPercent: number;
}

const BASELINE_PATH = '.vguard/baseline.json';

function baselinePath(projectRoot: string): string {
  return join(projectRoot, BASELINE_PATH);
}

/**
 * Freeze a conventions report into .vguard/baseline.json. Each subsequent
 * `vguard drift` run compares against this snapshot.
 */
export async function freezeBaseline(
  report: ConventionsReport,
  projectRoot: string,
): Promise<string> {
  const snap: BaselineSnapshot = {
    frozenAt: new Date().toISOString(),
    projectRoot: report.projectRoot,
    patterns: report.allPatterns,
  };
  const path = baselinePath(projectRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(snap, null, 2), 'utf-8');
  return path;
}

export async function readBaseline(projectRoot: string): Promise<BaselineSnapshot | null> {
  try {
    const path = baselinePath(projectRoot);
    if (!existsSync(path)) return null;
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as BaselineSnapshot;
  } catch {
    return null;
  }
}

/**
 * Compare the current conventions report against the stored baseline.
 * Drift percent = (new + vanished + changedConfidence with |delta|>=0.2) / total(baseline).
 */
export function computeDrift(current: ConventionsReport, baseline: BaselineSnapshot): DriftReport {
  const baselineByKey = new Map<string, DiscoveredPattern>();
  for (const p of baseline.patterns) baselineByKey.set(patternKey(p), p);

  const currentByKey = new Map<string, DiscoveredPattern>();
  for (const p of current.allPatterns) currentByKey.set(patternKey(p), p);

  const newPatterns: DiscoveredPattern[] = [];
  const vanishedPatterns: DiscoveredPattern[] = [];
  const changedConfidence: DriftReport['changedConfidence'] = [];

  for (const [k, p] of currentByKey) {
    if (!baselineByKey.has(k)) newPatterns.push(p);
  }
  for (const [k, p] of baselineByKey) {
    if (!currentByKey.has(k)) {
      vanishedPatterns.push(p);
      continue;
    }
    const now = currentByKey.get(k)!;
    const delta = now.confidence - p.confidence;
    if (Math.abs(delta) >= 0.2) {
      changedConfidence.push({
        pattern: k,
        was: p.confidence,
        now: now.confidence,
        delta,
      });
    }
  }

  const total = Math.max(baseline.patterns.length, 1);
  const changed = newPatterns.length + vanishedPatterns.length + changedConfidence.length;
  const driftPercent = Math.round((changed / total) * 1000) / 10; // one decimal

  return { newPatterns, vanishedPatterns, changedConfidence, driftPercent };
}

function patternKey(p: DiscoveredPattern): string {
  return `${p.type}::${p.description}`;
}
