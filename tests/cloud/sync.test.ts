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
  });
});
