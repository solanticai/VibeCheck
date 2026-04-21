import { describe, it, expect } from 'vitest';
import { getUnsyncedRecords, applyExclusions } from '../../src/cloud/sync.js';
import type { RuleHitRecord } from '../../src/engine/tracker.js';

function makeRecord(overrides: Partial<RuleHitRecord> = {}): RuleHitRecord {
  return {
    timestamp: '2026-04-01T12:00:00.000Z',
    ruleId: 'security/branch-protection',
    status: 'block',
    filePath: '/project/src/index.ts',
    event: 'PreToolUse',
    tool: 'Write',
    ...overrides,
  };
}

describe('cloud/sync', () => {
  describe('getUnsyncedRecords', () => {
    it('should return all records when cursor is null', () => {
      const records = [
        makeRecord({ timestamp: '2026-04-01T10:00:00Z' }),
        makeRecord({ timestamp: '2026-04-01T11:00:00Z' }),
      ];
      const result = getUnsyncedRecords(records, null);
      expect(result).toHaveLength(2);
    });

    it('should filter records older than cursor', () => {
      const records = [
        makeRecord({ timestamp: '2026-04-01T10:00:00Z' }),
        makeRecord({ timestamp: '2026-04-01T11:00:00Z' }),
        makeRecord({ timestamp: '2026-04-01T12:00:00Z' }),
      ];
      const cursor = { lastSyncedAt: '2026-04-01T10:30:00Z', lastBatchSize: 1 };
      const result = getUnsyncedRecords(records, cursor);
      expect(result).toHaveLength(2);
    });

    it('should return empty when all records are synced', () => {
      const records = [makeRecord({ timestamp: '2026-04-01T10:00:00Z' })];
      const cursor = { lastSyncedAt: '2026-04-01T11:00:00Z', lastBatchSize: 1 };
      const result = getUnsyncedRecords(records, cursor);
      expect(result).toHaveLength(0);
    });
  });

  describe('applyExclusions', () => {
    const projectRoot = '/project';

    it('should return records unchanged when no exclusions', () => {
      const records = [makeRecord()];
      const result = applyExclusions(records, projectRoot, []);
      expect(result[0].filePath).toBe('/project/src/index.ts');
    });

    it('should strip filePath for matching patterns', () => {
      const records = [
        makeRecord({ filePath: '/project/secrets/api-key.json' }),
        makeRecord({ filePath: '/project/src/index.ts' }),
      ];
      const result = applyExclusions(records, projectRoot, ['secrets/']);
      expect(result[0].filePath).toBeUndefined();
      expect(result[1].filePath).toBe('/project/src/index.ts');
    });

    it('should strip all paths with **/* pattern', () => {
      const records = [
        makeRecord({ filePath: '/project/src/index.ts' }),
        makeRecord({ filePath: '/project/lib/utils.ts' }),
      ];
      const result = applyExclusions(records, projectRoot, ['**/*']);
      expect(result[0].filePath).toBeUndefined();
      expect(result[1].filePath).toBeUndefined();
    });

    it('should preserve records with no filePath', () => {
      const records = [makeRecord({ filePath: undefined })];
      const result = applyExclusions(records, projectRoot, ['**/*']);
      expect(result).toHaveLength(1);
    });

    it('scrubs excluded path from future message field when filePath matches', () => {
      const records = [
        makeRecord({
          filePath: '/project/secrets/prod.env',
          // Intentional cast: simulates a future RuleHitRecord with `message`.
          message: 'Found hardcoded secret in /project/secrets/prod.env line 3',
        } as RuleHitRecord & { message: string }),
      ];
      const result = applyExclusions(records, projectRoot, ['secrets/**']) as Array<
        RuleHitRecord & { message?: string }
      >;
      expect(result[0].filePath).toBeUndefined();
      expect(result[0].message).toBe('Found hardcoded secret in [redacted] line 3');
    });

    it('scrubs basename from message as well as full path', () => {
      const records = [
        makeRecord({
          filePath: '/project/secrets/prod.env',
          message: 'prod.env has a problem',
        } as RuleHitRecord & { message: string }),
      ];
      const result = applyExclusions(records, projectRoot, ['secrets/**']) as Array<
        RuleHitRecord & { message?: string }
      >;
      expect(result[0].message).toBe('[redacted] has a problem');
    });

    it('scrubs excluded path from nested metadata structures', () => {
      const records = [
        makeRecord({
          filePath: '/project/secrets/foo.ts',
          metadata: {
            refs: ['/project/secrets/foo.ts', '/project/src/ok.ts'],
            detail: { path: '/project/secrets/foo.ts' },
          },
        } as RuleHitRecord & { metadata: unknown }),
      ];
      const result = applyExclusions(records, projectRoot, ['secrets/**']) as Array<
        RuleHitRecord & {
          metadata?: { refs?: string[]; detail?: { path?: string } };
        }
      >;
      expect(result[0].metadata?.refs?.[0]).toBe('[redacted]');
      // Unrelated paths stay intact.
      expect(result[0].metadata?.refs?.[1]).toBe('/project/src/ok.ts');
      expect(result[0].metadata?.detail?.path).toBe('[redacted]');
    });

    it('redacts OpenAI-style secrets even without an exclusion', () => {
      const records = [
        makeRecord({
          message: 'leaked sk-abc1234567890DEFghijklmnopqrstuvwxyz',
        } as RuleHitRecord & { message: string }),
      ];
      const result = applyExclusions(records, projectRoot, []) as Array<
        RuleHitRecord & { message?: string }
      >;
      expect(result[0].message).toBe('leaked [redacted]');
    });

    it('redacts GitHub PATs, AWS keys, and JWTs', () => {
      const records = [
        makeRecord({
          message:
            'tokens: ghp_abc1234567890ABCDEFghijklmn, AKIAIOSFODNN7EXAMPLE, ' +
            'jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefg',
        } as RuleHitRecord & { message: string }),
      ];
      const result = applyExclusions(records, projectRoot, []) as Array<
        RuleHitRecord & { message?: string }
      >;
      expect(result[0].message).toBe('tokens: [redacted], [redacted], jwt=[redacted]');
    });

    it('leaves benign records untouched', () => {
      const records = [
        makeRecord({
          filePath: '/project/src/index.ts',
          message: 'ordinary warning text',
        } as RuleHitRecord & { message: string }),
      ];
      const result = applyExclusions(records, projectRoot, []) as Array<
        RuleHitRecord & { message?: string }
      >;
      expect(result[0].filePath).toBe('/project/src/index.ts');
      expect(result[0].message).toBe('ordinary warning text');
    });
  });
});
