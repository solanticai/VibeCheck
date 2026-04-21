import { describe, it, expect } from 'vitest';
import { generateHtmlReport } from '../../src/report/html.js';
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
    ],
    ...overrides,
  };
}

describe('HTML Report Generator', () => {
  it('emits a valid html document with doctype and title', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<title>VGuard Quality Report</title>');
    expect(html).toContain('</html>');
  });

  it('includes debt score and totals', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('>25<');
    expect(html).toContain('150');
    expect(html).toContain('20 blocks');
    expect(html).toContain('80 warns');
    expect(html).toContain('50 passes');
  });

  it('renders rule rows when data is present', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('security/branch-protection');
    expect(html).toContain('quality/anti-patterns');
    expect(html).toContain('Rule Hit Frequency');
    expect(html).toContain('Top Rules by Activity');
  });

  it('handles empty rule hits without rendering rule sections', () => {
    const html = generateHtmlReport(makeReportData({ ruleHits: [], totalHits: 0 }));
    expect(html).not.toContain('Rule Hit Frequency');
    expect(html).toContain('No rule hit data');
  });

  it('escapes html-unsafe characters in rule ids', () => {
    const html = generateHtmlReport(
      makeReportData({
        ruleHits: [
          {
            ruleId: 'custom/<script>alert(1)</script>',
            totalHits: 1,
            blocks: 1,
            warns: 0,
            passes: 0,
            lastHit: '2026-04-01T00:00:00.000Z',
          },
        ],
      }),
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('interprets debt verdict based on score', () => {
    const good = generateHtmlReport(makeReportData({ debtScore: 5 }));
    expect(good).toContain('Excellent');

    const fair = generateHtmlReport(makeReportData({ debtScore: 45 }));
    expect(fair).toContain('Fair');

    const poor = generateHtmlReport(makeReportData({ debtScore: 80 }));
    expect(poor).toContain('Poor');
  });

  it('includes prefers-color-scheme dark mode styles', () => {
    const html = generateHtmlReport(makeReportData());
    expect(html).toContain('prefers-color-scheme: dark');
  });
});
