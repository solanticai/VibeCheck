import { describe, it, expect } from 'vitest';

import '../../src/presets/index.js';
import '../../src/rules/index.js';

import { getTemplate, hasTemplate } from '../../src/eject/templates/index.js';
import { generatePreamble } from '../../src/eject/templates/preamble.js';

describe('getTemplate', () => {
  it('returns template function for known security rules', () => {
    expect(getTemplate('security/branch-protection')).toBeTypeOf('function');
    expect(getTemplate('security/destructive-commands')).toBeTypeOf('function');
    expect(getTemplate('security/secret-detection')).toBeTypeOf('function');
  });

  it('returns template function for known quality rules', () => {
    expect(getTemplate('quality/anti-patterns')).toBeTypeOf('function');
    expect(getTemplate('quality/import-aliases')).toBeTypeOf('function');
    expect(getTemplate('quality/no-use-client-in-pages')).toBeTypeOf('function');
  });

  it('returns template function for known workflow rules', () => {
    expect(getTemplate('workflow/commit-conventions')).toBeTypeOf('function');
    expect(getTemplate('workflow/migration-safety')).toBeTypeOf('function');
    expect(getTemplate('workflow/pr-reminder')).toBeTypeOf('function');
  });

  it('returns undefined for unknown rule ID', () => {
    expect(getTemplate('nonexistent/rule')).toBeUndefined();
    expect(getTemplate('')).toBeUndefined();
  });

  it('template functions return valid JavaScript strings', () => {
    const template = getTemplate('security/branch-protection');
    expect(template).toBeDefined();

    const code = template!({
      ruleId: 'security/branch-protection',
      severity: 'block',
      options: {},
      event: 'PreToolUse',
    });

    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
  });
});

describe('hasTemplate', () => {
  it('returns true for rules with templates', () => {
    expect(hasTemplate('security/branch-protection')).toBe(true);
    expect(hasTemplate('quality/anti-patterns')).toBe(true);
    expect(hasTemplate('workflow/pr-reminder')).toBe(true);
  });

  it('returns false for rules without templates', () => {
    expect(hasTemplate('nonexistent/rule')).toBe(false);
    expect(hasTemplate('')).toBe(false);
  });
});

describe('generatePreamble', () => {
  it('returns valid JavaScript preamble', () => {
    const preamble = generatePreamble();
    expect(preamble).toContain("'use strict'");
    expect(preamble).toContain('require');
  });

  it('includes stdin reader', () => {
    const preamble = generatePreamble();
    expect(preamble).toContain('readFileSync');
    expect(preamble).toContain('JSON.parse');
  });

  it('includes issues array initialization', () => {
    const preamble = generatePreamble();
    expect(preamble).toContain('const issues = []');
  });

  it('includes git context builder', () => {
    const preamble = generatePreamble();
    expect(preamble).toContain('branch');
    expect(preamble).toContain('repoRoot');
  });

  it('includes pattern constants', () => {
    const preamble = generatePreamble();
    expect(preamble).toContain('SECRET_PATTERNS');
    expect(preamble).toContain('DANGEROUS_COMMAND_PATTERNS');
    expect(preamble).toContain('DANGEROUS_SQL_PATTERNS');
  });
});
