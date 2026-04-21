import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freezeBaseline, readBaseline, computeDrift } from '../../src/learn/baseline.js';
import type { ConventionsReport } from '../../src/learn/aggregator.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'vg-drift-'));
});
afterEach(() => {
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

function report(
  patterns: Array<{
    type: 'import' | 'naming' | 'structure';
    description: string;
    confidence: number;
  }>,
): ConventionsReport {
  return {
    generatedAt: new Date().toISOString(),
    projectRoot: tmp,
    filesAnalyzed: 10,
    analyzers: [],
    allPatterns: patterns.map((p) => ({
      ...p,
      occurrences: 5,
      totalFiles: 10,
      examples: [],
      promotable: p.confidence >= 0.7,
    })),
    promotablePatterns: [],
  };
}

describe('learn/baseline', () => {
  it('freeze + read round-trips', async () => {
    const rep = report([{ type: 'import', description: 'uses @/ alias', confidence: 0.9 }]);
    await freezeBaseline(rep, tmp);
    const loaded = await readBaseline(tmp);
    expect(loaded).toBeTruthy();
    expect(loaded?.patterns).toHaveLength(1);
  });

  it('returns null when no baseline exists', async () => {
    const loaded = await readBaseline(tmp);
    expect(loaded).toBeNull();
  });

  it('reports new patterns', async () => {
    const old = report([{ type: 'import', description: 'uses @/ alias', confidence: 0.9 }]);
    await freezeBaseline(old, tmp);
    const baseline = (await readBaseline(tmp))!;
    const current = report([
      { type: 'import', description: 'uses @/ alias', confidence: 0.9 },
      { type: 'naming', description: 'kebab-case files', confidence: 0.8 },
    ]);
    const drift = computeDrift(current, baseline);
    expect(drift.newPatterns).toHaveLength(1);
    expect(drift.vanishedPatterns).toHaveLength(0);
    expect(drift.driftPercent).toBeGreaterThan(0);
  });

  it('reports vanished patterns', async () => {
    const old = report([
      { type: 'import', description: 'a', confidence: 0.9 },
      { type: 'import', description: 'b', confidence: 0.9 },
    ]);
    await freezeBaseline(old, tmp);
    const baseline = (await readBaseline(tmp))!;
    const current = report([{ type: 'import', description: 'a', confidence: 0.9 }]);
    const drift = computeDrift(current, baseline);
    expect(drift.vanishedPatterns).toHaveLength(1);
  });

  it('reports significant confidence changes', async () => {
    const old = report([{ type: 'import', description: 'x', confidence: 0.9 }]);
    await freezeBaseline(old, tmp);
    const baseline = (await readBaseline(tmp))!;
    const current = report([{ type: 'import', description: 'x', confidence: 0.5 }]);
    const drift = computeDrift(current, baseline);
    expect(drift.changedConfidence).toHaveLength(1);
    expect(drift.changedConfidence[0].delta).toBeCloseTo(-0.4, 1);
  });
});
