import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RuleResult } from '../../src/types.js';

// Mock fs to avoid real file operations
const mockStore = new Map<string, string>();
vi.mock('node:fs', async () => {
  return {
    existsSync: vi.fn((p: string) => mockStore.has(p)),
    readFileSync: vi.fn((p: string) => {
      const content = mockStore.get(p);
      if (!content) throw new Error('ENOENT');
      return content;
    }),
    appendFileSync: vi.fn((p: string, content: string) => {
      const existing = mockStore.get(p) ?? '';
      mockStore.set(p, existing + content);
    }),
    mkdirSync: vi.fn(),
    statSync: vi.fn(() => ({ size: 100 })),
    renameSync: vi.fn(),
  };
});

const { recordRuleHit, readRuleHits } = await import('../../src/engine/tracker.js');

describe('engine/tracker', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('should record a rule hit', () => {
    const result: RuleResult = {
      status: 'block',
      ruleId: 'security/branch-protection',
      message: 'Cannot write on main',
    };

    recordRuleHit(result, 'PreToolUse', 'Write', '/src/index.ts', '/project');

    const hits = readRuleHits('/project');
    expect(hits).toHaveLength(1);
    expect(hits[0].ruleId).toBe('security/branch-protection');
    expect(hits[0].status).toBe('block');
    expect(hits[0].tool).toBe('Write');
  });

  it('should read multiple hits', () => {
    const result1: RuleResult = { status: 'block', ruleId: 'rule-1' };
    const result2: RuleResult = { status: 'warn', ruleId: 'rule-2' };

    recordRuleHit(result1, 'PreToolUse', 'Write', '/a.ts', '/project');
    recordRuleHit(result2, 'PostToolUse', 'Edit', '/b.ts', '/project');

    const hits = readRuleHits('/project');
    expect(hits).toHaveLength(2);
  });

  it('should return empty array when no log exists', () => {
    const hits = readRuleHits('/nonexistent');
    expect(hits).toEqual([]);
  });

  it('should handle malformed JSON lines gracefully', () => {
    // Record a valid hit first so the file exists
    const result: RuleResult = { status: 'pass', ruleId: 'valid' };
    recordRuleHit(result, 'PreToolUse', 'Write', '/a.ts', '/project');

    // Append a malformed line to the same file
    // Find the key that was created (join produces platform-specific path)
    for (const [key] of mockStore) {
      if (key.includes('rule-hits.jsonl')) {
        mockStore.set(key, mockStore.get(key)! + 'not-json\n');
      }
    }

    const hits = readRuleHits('/project');
    // Should have at least 1 valid hit, malformed line is skipped
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].ruleId).toBe('valid');
  });

  it('should include sessionId when provided', () => {
    const result: RuleResult = { status: 'pass', ruleId: 'security/branch-protection' };
    recordRuleHit(result, 'PreToolUse', 'Edit', '/src/a.ts', '/project', 'sess_abc123');

    const hits = readRuleHits('/project');
    expect(hits).toHaveLength(1);
    expect(hits[0].sessionId).toBe('sess_abc123');
  });

  it('should omit sessionId when not provided', () => {
    const result: RuleResult = { status: 'pass', ruleId: 'rule' };
    recordRuleHit(result, 'PreToolUse', 'Edit', '/src/a.ts', '/project');

    const hits = readRuleHits('/project');
    expect(hits).toHaveLength(1);
    expect(hits[0].sessionId).toBeUndefined();
  });
});
