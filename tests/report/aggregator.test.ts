import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { aggregateReport } from '../../src/report/aggregator.js';
import { generateMarkdownReport } from '../../src/report/markdown.js';

const TEST_DIR = join(process.cwd(), '.vguard-test-report');
const LOG_DIR = join(TEST_DIR, '.vguard', 'data');
const LOG_PATH = join(LOG_DIR, 'rule-hits.jsonl');

describe('aggregateReport', () => {
  beforeEach(() => {
    mkdirSync(LOG_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });
  it('should return empty report when no data', () => {
    const data = aggregateReport(TEST_DIR);
    expect(data.totalHits).toBe(0);
    expect(data.ruleHits).toHaveLength(0);
    expect(data.debtScore).toBe(0);
  });

  it('should aggregate rule hits correctly', () => {
    const records = [
      {
        timestamp: '2026-01-01T00:00:00Z',
        ruleId: 'security/branch-protection',
        status: 'block',
        event: 'PreToolUse',
        tool: 'Edit',
      },
      {
        timestamp: '2026-01-01T00:01:00Z',
        ruleId: 'security/branch-protection',
        status: 'pass',
        event: 'PreToolUse',
        tool: 'Edit',
      },
      {
        timestamp: '2026-01-01T00:02:00Z',
        ruleId: 'quality/import-aliases',
        status: 'warn',
        event: 'PreToolUse',
        tool: 'Write',
      },
      {
        timestamp: '2026-01-01T00:03:00Z',
        ruleId: 'quality/import-aliases',
        status: 'pass',
        event: 'PreToolUse',
        tool: 'Write',
      },
    ];

    writeFileSync(LOG_PATH, records.map((r) => JSON.stringify(r)).join('\n') + '\n');

    const data = aggregateReport(TEST_DIR);
    expect(data.totalHits).toBe(4);
    expect(data.ruleHits).toHaveLength(2);
    expect(data.blockWarnRatio.blocks).toBe(1);
    expect(data.blockWarnRatio.warns).toBe(1);
    expect(data.blockWarnRatio.passes).toBe(2);
  });

  it('should calculate debt score', () => {
    const records = [
      {
        timestamp: '2026-01-01T00:00:00Z',
        ruleId: 'r1',
        status: 'block',
        event: 'PreToolUse',
        tool: 'Edit',
      },
      {
        timestamp: '2026-01-01T00:01:00Z',
        ruleId: 'r1',
        status: 'block',
        event: 'PreToolUse',
        tool: 'Edit',
      },
      {
        timestamp: '2026-01-01T00:02:00Z',
        ruleId: 'r1',
        status: 'pass',
        event: 'PreToolUse',
        tool: 'Edit',
      },
      {
        timestamp: '2026-01-01T00:03:00Z',
        ruleId: 'r1',
        status: 'pass',
        event: 'PreToolUse',
        tool: 'Edit',
      },
    ];

    writeFileSync(LOG_PATH, records.map((r) => JSON.stringify(r)).join('\n') + '\n');

    const data = aggregateReport(TEST_DIR);
    expect(data.debtScore).toBe(50); // 2 issues out of 4 = 50%
  });
});

describe('generateMarkdownReport', () => {
  it('should generate valid markdown', () => {
    const data = {
      generatedAt: '2026-01-01T00:00:00Z',
      totalHits: 10,
      ruleHits: [
        {
          ruleId: 'security/branch-protection',
          totalHits: 5,
          blocks: 2,
          warns: 0,
          passes: 3,
          lastHit: '2026-01-01T00:00:00Z',
        },
        {
          ruleId: 'quality/import-aliases',
          totalHits: 5,
          blocks: 0,
          warns: 3,
          passes: 2,
          lastHit: '2026-01-01T00:00:00Z',
        },
      ],
      blockWarnRatio: { blocks: 2, warns: 3, passes: 5 },
      debtScore: 50,
    };

    const md = generateMarkdownReport(data);
    expect(md).toContain('# VGuard Quality Report');
    expect(md).toContain('security/branch-protection');
    expect(md).toContain('50/100');
    expect(md).toContain('Rule Hit Frequency');
  });
});
