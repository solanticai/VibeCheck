import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  recordUsage,
  readUsage,
  summariseUsage,
  currentSessionSpend,
  rollingWindowSpend,
} from '../../src/engine/cost-tracker.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'vg-cost-'));
  return () => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  };
});

describe('cost-tracker', () => {
  it('records a usage row and reads it back', () => {
    const rec = recordUsage(tmp, {
      inputTokens: 100,
      outputTokens: 50,
      model: 'claude-opus-4-5',
      sessionId: 's-1',
      modelPricing: {
        'claude-opus-4-5': { inputPer1M: 15, outputPer1M: 75 },
      },
    });
    expect(rec).toBeTruthy();
    expect(rec?.usd).toBeCloseTo((100 * 15) / 1_000_000 + (50 * 75) / 1_000_000, 10);

    const all = readUsage(tmp);
    expect(all).toHaveLength(1);
    expect(all[0].inputTokens).toBe(100);
  });

  it('summarises totals correctly', () => {
    recordUsage(tmp, { inputTokens: 10, outputTokens: 5, sessionId: 's' });
    recordUsage(tmp, { inputTokens: 20, outputTokens: 7, sessionId: 's' });
    const s = summariseUsage(readUsage(tmp));
    expect(s.totalInputTokens).toBe(30);
    expect(s.totalOutputTokens).toBe(12);
    expect(s.records).toBe(2);
  });

  it('filters by session id', () => {
    recordUsage(tmp, { inputTokens: 10, outputTokens: 5, sessionId: 'a' });
    recordUsage(tmp, { inputTokens: 20, outputTokens: 7, sessionId: 'b' });
    const s = currentSessionSpend(tmp, 'a');
    expect(s.totalInputTokens).toBe(10);
    expect(s.records).toBe(1);
  });

  it('returns zeros for missing session id', () => {
    const s = currentSessionSpend(tmp, undefined);
    expect(s.totalInputTokens).toBe(0);
    expect(s.records).toBe(0);
  });

  it('filters by rolling window', () => {
    recordUsage(tmp, { inputTokens: 1, outputTokens: 1 });
    const past = rollingWindowSpend(tmp, 24 * 60 * 60 * 1000);
    expect(past.records).toBeGreaterThan(0);

    const zero = rollingWindowSpend(tmp, 0);
    expect(zero.records).toBe(0);
  });

  it('returns null silently when passed an invalid path', () => {
    // Root with non-writable path on Windows — should not throw
    const r = recordUsage('\0/not/real', { inputTokens: 1, outputTokens: 1 });
    expect(r).toBeNull();
  });
});
