import { describe, it, expect } from 'vitest';
import { generateMarkdownReport } from '../../src/report/markdown.js';
import type { QualityReportData } from '../../src/report/aggregator.js';

function makeReportData(overrides: Partial<QualityReportData> = {}): QualityReportData {
  return {
    generatedAt: '2026-04-01T12:00:00.000Z',
    totalHits: 150,
    blockWarnRatio: { blocks: 20, warns: 80, passes: 50 },
    debtScore: 25,
    ruleHits: [
      {
        ruleId: 'security/branch-protection',
        totalHits: 50,
        blocks: 15,
        warns: 0,
        passes: 35,
        lastHit: '2026-04-01T11:00:00.000Z',
      },
      {
        ruleId: 'quality/anti-patterns',
        totalHits: 40,
        blocks: 0,
        warns: 30,
        passes: 10,
        lastHit: '2026-04-01T10:30:00.000Z',
      },
      {
        ruleId: 'quality/import-aliases',
        totalHits: 30,
        blocks: 5,
        warns: 20,
        passes: 5,
        lastHit: '2026-04-01T09:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('Markdown Report Generator', () => {
  it('generates valid markdown with title', () => {
    const report = generateMarkdownReport(makeReportData());
    expect(report).toContain('# VGuard Quality Report');
    expect(report).toContain('Generated:');
  });

  it('includes overview metrics table', () => {
    const report = generateMarkdownReport(makeReportData());
    expect(report).toContain('## Overview');
    expect(report).toContain('Total rule executions');
    expect(report).toContain('150');
    expect(report).toContain('Technical debt score');
    expect(report).toContain('25/100');
  });

  it('includes rule hit frequency table', () => {
    const report = generateMarkdownReport(makeReportData());
    expect(report).toContain('## Rule Hit Frequency');
    expect(report).toContain('`security/branch-protection`');
    expect(report).toContain('`quality/anti-patterns`');
  });

  it('includes most blocked rules section', () => {
    const report = generateMarkdownReport(makeReportData());
    expect(report).toContain('## Most Blocked Rules');
    expect(report).toContain('security/branch-protection');
  });

  it('handles empty rule hits gracefully', () => {
    const report = generateMarkdownReport(makeReportData({ ruleHits: [], totalHits: 0 }));
    expect(report).toContain('# VGuard Quality Report');
    expect(report).not.toContain('## Rule Hit Frequency');
  });

  it('provides debt score interpretation', () => {
    // Low debt
    let report = generateMarkdownReport(makeReportData({ debtScore: 5 }));
    expect(report).toContain('Excellent');

    // Medium debt
    report = generateMarkdownReport(makeReportData({ debtScore: 45 }));
    expect(report).toContain('Fair');

    // High debt
    report = generateMarkdownReport(makeReportData({ debtScore: 80 }));
    expect(report).toContain('Poor');
  });
});
