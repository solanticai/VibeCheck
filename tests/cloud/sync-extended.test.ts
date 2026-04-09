import { describe, it, expect, beforeEach } from 'vitest';
import { readSyncCursor, writeSyncCursor, syncToCloud } from '../../src/cloud/sync.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('sync cursor I/O', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = join(
      tmpdir(),
      'vguard-sync-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    );
    mkdirSync(tmpRoot, { recursive: true });
  });

  it('returns null when no cursor file exists', () => {
    expect(readSyncCursor(tmpRoot)).toBeNull();
  });

  it('round-trips cursor to disk', () => {
    const cursor = { lastSyncedAt: '2026-04-01T12:00:00Z', lastBatchSize: 42 };
    writeSyncCursor(tmpRoot, cursor);
    expect(readSyncCursor(tmpRoot)).toEqual(cursor);
  });

  it('creates intermediate directories', () => {
    const deepRoot = join(tmpRoot, 'nested', 'path');
    const cursor = { lastSyncedAt: '2026-04-01T12:00:00Z', lastBatchSize: 1 };
    writeSyncCursor(deepRoot, cursor);
    expect(readSyncCursor(deepRoot)).toEqual(cursor);
  });
});

describe('syncToCloud', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = join(
      tmpdir(),
      'vguard-sync-cloud-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    );
    mkdirSync(tmpRoot, { recursive: true });
  });

  it('returns zero when no rule hits exist', async () => {
    const result = await syncToCloud(tmpRoot, 'api_key_test');
    expect(result).toEqual({ synced: 0, skipped: 0 });
  });

  it('returns skipped count in dry-run mode', async () => {
    // Create a rule hits file
    const dataDir = join(tmpRoot, '.vguard', 'data');
    mkdirSync(dataDir, { recursive: true });
    const hit = {
      timestamp: new Date().toISOString(),
      ruleId: 'security/branch-protection',
      status: 'block',
      event: 'PreToolUse',
      tool: 'Write',
    };
    writeFileSync(join(dataDir, 'rule-hits.jsonl'), JSON.stringify(hit) + '\n', 'utf-8');

    const result = await syncToCloud(tmpRoot, 'api_key_test', { dryRun: true });
    expect(result.synced).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('returns error message on fetch failure', async () => {
    const dataDir = join(tmpRoot, '.vguard', 'data');
    mkdirSync(dataDir, { recursive: true });
    const hit = {
      timestamp: new Date().toISOString(),
      ruleId: 'security/branch-protection',
      status: 'block',
      event: 'PreToolUse',
      tool: 'Write',
    };
    writeFileSync(join(dataDir, 'rule-hits.jsonl'), JSON.stringify(hit) + '\n', 'utf-8');

    // This will fail at the network level since no real server exists
    const result = await syncToCloud(tmpRoot, 'api_key_test', {
      apiUrl: 'http://localhost:1',
    });
    expect(result.synced).toBe(0);
    expect(result.error).toBeDefined();
  });
});
