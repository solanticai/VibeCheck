import { describe, it, expect } from 'vitest';
import { formatText } from '../../src/cli/formatters/text.js';
import { formatJson } from '../../src/cli/formatters/json.js';
import { formatGitHubActions } from '../../src/cli/formatters/github-actions.js';
import type { ScanResult } from '../../src/engine/scanner.js';

const emptyResult: ScanResult = {
  filesScanned: 10,
  issues: [],
  hasBlockingIssues: false,
};

const issueResult: ScanResult = {
  filesScanned: 25,
  issues: [
    { ruleId: 'security/branch-protection', severity: 'block', filePath: '/src/app.ts', message: 'Writing to main branch' },
    { ruleId: 'quality/anti-patterns', severity: 'warn', filePath: '/src/utils.ts', message: 'console.log detected', fix: 'Use a logger' },
    { ruleId: 'quality/import-aliases', severity: 'warn', filePath: '/src/app.ts', message: 'Use @/ alias' },
  ],
  hasBlockingIssues: true,
};

describe('TextFormatter', () => {
  it('reports no issues when scan is clean', () => {
    const output = formatText(emptyResult);
    expect(output).toContain('10 files scanned');
    expect(output).toContain('No issues found');
  });

  it('formats violations grouped by file', () => {
    const output = formatText(issueResult);
    expect(output).toContain('25 files scanned');
    expect(output).toContain('/src/app.ts');
    expect(output).toContain('/src/utils.ts');
    expect(output).toContain('branch-protection');
    expect(output).toContain('console.log detected');
  });

  it('includes fix suggestions', () => {
    const output = formatText(issueResult);
    expect(output).toContain('Fix: Use a logger');
  });

  it('shows summary counts', () => {
    const output = formatText(issueResult);
    expect(output).toContain('3 issues');
    expect(output).toContain('1 blocking');
    expect(output).toContain('2 warnings');
  });
});

describe('JsonFormatter', () => {
  it('outputs valid JSON', () => {
    const output = formatJson(issueResult);
    const parsed = JSON.parse(output);
    expect(parsed.filesScanned).toBe(25);
    expect(parsed.issues).toHaveLength(3);
  });

  it('includes all issue fields', () => {
    const output = formatJson(issueResult);
    const parsed = JSON.parse(output);
    expect(parsed.issues[0]).toHaveProperty('ruleId');
    expect(parsed.issues[0]).toHaveProperty('severity');
    expect(parsed.issues[0]).toHaveProperty('filePath');
    expect(parsed.issues[0]).toHaveProperty('message');
  });

  it('outputs clean JSON for empty results', () => {
    const output = formatJson(emptyResult);
    const parsed = JSON.parse(output);
    expect(parsed.issues).toHaveLength(0);
  });
});

describe('GitHubActionsFormatter', () => {
  it('outputs ::error:: for blocking issues', () => {
    const output = formatGitHubActions(issueResult);
    expect(output).toContain('::error file=');
    expect(output).toContain('branch-protection');
  });

  it('outputs ::warning:: for warnings', () => {
    const output = formatGitHubActions(issueResult);
    expect(output).toContain('::warning file=');
  });

  it('includes file path in annotations', () => {
    const output = formatGitHubActions(issueResult);
    expect(output).toContain('file=/src/app.ts');
  });

  it('outputs notice for clean scan', () => {
    const output = formatGitHubActions(emptyResult);
    expect(output).toContain('::notice::');
    expect(output).toContain('No issues found');
  });
});
