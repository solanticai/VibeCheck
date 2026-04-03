import { describe, it, expect } from 'vitest';
import {
  formatPreToolUseOutput,
  formatPostToolUseOutput,
  formatStopOutput,
} from '../../src/engine/output.js';
import type { RunResult } from '../../src/engine/runner.js';

function makePassResult(): RunResult {
  return {
    blocked: false,
    blockingResult: null,
    warnings: [],
    results: [{ status: 'pass', ruleId: 'test/pass' }],
  };
}

function makeBlockResult(ruleId = 'security/test', message = 'Blocked', fix?: string): RunResult {
  return {
    blocked: true,
    blockingResult: { status: 'block', ruleId, message, fix },
    warnings: [],
    results: [{ status: 'block', ruleId, message, fix }],
  };
}

function makeWarnResult(
  warnings: Array<{ ruleId: string; message: string; fix?: string }>,
): RunResult {
  return {
    blocked: false,
    blockingResult: null,
    warnings: warnings.map((w) => ({ status: 'warn' as const, ...w })),
    results: warnings.map((w) => ({ status: 'warn' as const, ...w })),
  };
}

describe('formatPreToolUseOutput', () => {
  it('returns exit code 2 with stderr message when blocked', () => {
    const result = makeBlockResult('security/branch', 'Cannot write to main');
    const output = formatPreToolUseOutput(result);
    expect(output.exitCode).toBe(2);
    expect(output.stderr).toContain('BLOCKED by VGuard [security/branch]');
    expect(output.stderr).toContain('Cannot write to main');
    expect(output.stdout).toBe('');
  });

  it('includes fix suggestion in blocked message', () => {
    const result = makeBlockResult('security/test', 'Blocked', 'Switch to a feature branch');
    const output = formatPreToolUseOutput(result);
    expect(output.stderr).toContain('Fix: Switch to a feature branch');
  });

  it('returns exit code 0 with JSON stdout for warnings', () => {
    const result = makeWarnResult([{ ruleId: 'quality/test', message: 'Consider using aliases' }]);
    const output = formatPreToolUseOutput(result);
    expect(output.exitCode).toBe(0);
    expect(output.stderr).toBe('');

    const parsed = JSON.parse(output.stdout);
    expect(parsed.continue).toBe(true);
    expect(parsed.systemMessage).toContain('VGuard warnings');
    expect(parsed.systemMessage).toContain('quality/test');
  });

  it('formats multiple warnings in systemMessage', () => {
    const result = makeWarnResult([
      { ruleId: 'quality/a', message: 'Warning A' },
      { ruleId: 'quality/b', message: 'Warning B', fix: 'Fix B' },
    ]);
    const output = formatPreToolUseOutput(result);
    const parsed = JSON.parse(output.stdout);
    expect(parsed.systemMessage).toContain('[quality/a] Warning A');
    expect(parsed.systemMessage).toContain('[quality/b] Warning B');
    expect(parsed.systemMessage).toContain('Fix: Fix B');
  });

  it('returns exit code 0 with empty output when all pass', () => {
    const result = makePassResult();
    const output = formatPreToolUseOutput(result);
    expect(output.exitCode).toBe(0);
    expect(output.stderr).toBe('');
    expect(output.stdout).toBe('');
  });
});

describe('formatPostToolUseOutput', () => {
  it('returns JSON with decision:block for non-pass results', () => {
    const result: RunResult = {
      blocked: false,
      blockingResult: null,
      warnings: [],
      results: [{ status: 'warn', ruleId: 'quality/test', message: 'Issue found' }],
    };
    const output = formatPostToolUseOutput(result);
    const parsed = JSON.parse(output.stdout);
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('[quality/test] Issue found');
  });

  it('includes fix suggestions in feedback', () => {
    const result: RunResult = {
      blocked: false,
      blockingResult: null,
      warnings: [],
      results: [
        { status: 'warn', ruleId: 'quality/test', message: 'Bad pattern', fix: 'Use good pattern' },
      ],
    };
    const output = formatPostToolUseOutput(result);
    const parsed = JSON.parse(output.stdout);
    expect(parsed.reason).toContain('Fix: Use good pattern');
  });

  it('returns empty output when all pass', () => {
    const result = makePassResult();
    const output = formatPostToolUseOutput(result);
    expect(output.stdout).toBe('');
  });

  it('always returns exit code 0', () => {
    const blockResult: RunResult = {
      blocked: false,
      blockingResult: null,
      warnings: [],
      results: [{ status: 'block', ruleId: 'test/block', message: 'blocked' }],
    };
    expect(formatPostToolUseOutput(blockResult).exitCode).toBe(0);
    expect(formatPostToolUseOutput(makePassResult()).exitCode).toBe(0);
  });
});

describe('formatStopOutput', () => {
  it('writes summary to stderr for non-pass results', () => {
    const result: RunResult = {
      blocked: false,
      blockingResult: null,
      warnings: [],
      results: [
        { status: 'warn', ruleId: 'workflow/pr', message: 'You have unpushed commits' },
        { status: 'warn', ruleId: 'workflow/todo', message: '3 TODO items remaining' },
      ],
    };
    const output = formatStopOutput(result);
    expect(output.stderr).toContain('VGuard session summary');
    expect(output.stderr).toContain('You have unpushed commits');
    expect(output.stderr).toContain('3 TODO items remaining');
  });

  it('returns empty stderr when all pass', () => {
    const result = makePassResult();
    const output = formatStopOutput(result);
    expect(output.stderr).toBe('');
  });

  it('always returns exit code 0', () => {
    const warnResult: RunResult = {
      blocked: false,
      blockingResult: null,
      warnings: [],
      results: [{ status: 'warn', ruleId: 'test', message: 'warning' }],
    };
    expect(formatStopOutput(warnResult).exitCode).toBe(0);
    expect(formatStopOutput(makePassResult()).exitCode).toBe(0);
  });
});
