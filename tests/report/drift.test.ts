import { describe, it, expect, vi } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

vi.mock('../../src/learn/walker.js', () => ({
  walkProject: vi.fn(() => []),
}));

vi.mock('../../src/learn/aggregator.js', () => ({
  aggregateConventions: vi.fn(() => ({
    allPatterns: [],
    promotablePatterns: [],
    summary: {},
  })),
}));

import { existsSync, readFileSync } from 'node:fs';
import { walkProject } from '../../src/learn/walker.js';
import { aggregateConventions } from '../../src/learn/aggregator.js';
import { detectDrift } from '../../src/report/drift.js';

describe('Drift Detector', () => {
  it('returns low-severity issue when no baseline exists', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const issues = detectDrift('/project');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('low');
    expect(issues[0].description).toContain('No conventions.json found');
  });

  it('returns medium-severity issue when baseline is malformed', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('not-json');
    const issues = detectDrift('/project');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('medium');
    expect(issues[0].description).toContain('malformed');
  });

  it('detects dropped conventions', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        promotablePatterns: [
          {
            type: 'import',
            description: 'Uses @/ path alias',
            confidence: 0.9,
            totalFiles: 100,
            occurrences: 90,
          },
        ],
        allPatterns: [],
        summary: {},
      }),
    );
    vi.mocked(walkProject).mockReturnValue([]);
    vi.mocked(aggregateConventions).mockReturnValue({
      allPatterns: [], // Convention no longer found
      promotablePatterns: [],
      summary: {},
    } as ReturnType<typeof aggregateConventions>);

    const issues = detectDrift('/project');
    expect(issues.some((i) => i.description.includes('no longer detected'))).toBe(true);
  });

  it('detects confidence drops', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        promotablePatterns: [
          {
            type: 'import',
            description: 'Uses @/ path alias',
            confidence: 0.9,
            totalFiles: 100,
            occurrences: 90,
          },
        ],
        allPatterns: [],
        summary: {},
      }),
    );
    vi.mocked(walkProject).mockReturnValue([]);
    vi.mocked(aggregateConventions).mockReturnValue({
      allPatterns: [
        {
          type: 'import',
          description: 'Uses @/ path alias',
          confidence: 0.5,
          totalFiles: 100,
          occurrences: 50,
        },
      ],
      promotablePatterns: [],
      summary: {},
    } as ReturnType<typeof aggregateConventions>);

    const issues = detectDrift('/project');
    expect(
      issues.some((i) => i.severity === 'high' && i.description.includes('Confidence dropped')),
    ).toBe(true);
  });

  it('returns empty results when conventions match', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        promotablePatterns: [
          {
            type: 'import',
            description: 'Uses @/ path alias',
            confidence: 0.9,
            totalFiles: 100,
            occurrences: 90,
          },
        ],
        allPatterns: [],
        summary: {},
      }),
    );
    vi.mocked(walkProject).mockReturnValue([]);
    vi.mocked(aggregateConventions).mockReturnValue({
      allPatterns: [
        {
          type: 'import',
          description: 'Uses @/ path alias',
          confidence: 0.88,
          totalFiles: 100,
          occurrences: 88,
        },
      ],
      promotablePatterns: [],
      summary: {},
    } as ReturnType<typeof aggregateConventions>);

    const issues = detectDrift('/project');
    expect(issues).toHaveLength(0);
  });
});
