import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadLocalRules,
  loadLocalRulesFromPaths,
  validateLocalRule,
} from '../../src/plugins/local-rule-loader.js';
import { clearRegistry, getRule } from '../../src/engine/registry.js';

describe('validateLocalRule', () => {
  it('rejects null / non-object default exports', () => {
    expect(validateLocalRule(null, 'x.ts').valid).toBe(false);
    expect(validateLocalRule(42, 'x.ts').valid).toBe(false);
    expect(validateLocalRule('nope', 'x.ts').valid).toBe(false);
  });

  it('requires category/name id format', () => {
    const res = validateLocalRule(
      {
        id: 'no-slash',
        name: 'x',
        severity: 'warn',
        events: ['PreToolUse'],
        check: () => ({ status: 'pass', ruleId: 'no-slash' }),
      },
      'x.ts',
    );
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/category\/name format/);
  });

  it('requires a check function and at least one event', () => {
    const res = validateLocalRule(
      {
        id: 'custom/foo',
        name: 'Foo',
        severity: 'warn',
        events: [],
      },
      'foo.ts',
    );
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => /check/.test(e))).toBe(true);
    expect(res.errors.some((e) => /event/.test(e))).toBe(true);
  });

  it('accepts a well-shaped rule', () => {
    const res = validateLocalRule(
      {
        id: 'custom/foo',
        name: 'Foo',
        severity: 'warn',
        events: ['PreToolUse'],
        check: () => ({ status: 'pass', ruleId: 'custom/foo' }),
      },
      'foo.ts',
    );
    expect(res.valid).toBe(true);
    expect(res.rule?.id).toBe('custom/foo');
  });
});

describe('loadLocalRules', () => {
  let projectRoot: string;

  beforeEach(() => {
    clearRegistry();
    projectRoot = mkdtempSync(join(tmpdir(), 'vguard-local-rule-'));
  });

  afterEach(() => {
    if (existsSync(projectRoot)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('returns directoryExists=false when .vguard/rules/custom is absent', async () => {
    const result = await loadLocalRules(projectRoot);
    expect(result.directoryExists).toBe(false);
    expect(result.rulesAdded).toBe(0);
  });

  it('loads a well-formed .js rule and registers it', async () => {
    const dir = join(projectRoot, '.vguard', 'rules', 'custom');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'foo.mjs'),
      `export default {
        id: 'custom/foo',
        name: 'Foo',
        description: 'd',
        severity: 'warn',
        events: ['PreToolUse'],
        match: {},
        check: () => ({ status: 'pass', ruleId: 'custom/foo' }),
      };`,
    );

    const result = await loadLocalRules(projectRoot);
    expect(result.directoryExists).toBe(true);
    expect(result.rulesAdded).toBe(1);
    expect(result.loaded).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(getRule('custom/foo')).toBeDefined();
  });

  it('downgrades block-severity local rules to warn', async () => {
    const dir = join(projectRoot, '.vguard', 'rules', 'custom');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'strict.mjs'),
      `export default {
        id: 'custom/strict',
        name: 'Strict',
        description: 'd',
        severity: 'block',
        events: ['PreToolUse'],
        match: {},
        check: () => ({ status: 'pass', ruleId: 'custom/strict' }),
      };`,
    );

    const result = await loadLocalRules(projectRoot);
    expect(result.rulesAdded).toBe(1);
    expect(result.downgraded).toHaveLength(1);
    expect(getRule('custom/strict')?.severity).toBe('warn');
  });

  it('records malformed modules in errors without throwing', async () => {
    const dir = join(projectRoot, '.vguard', 'rules', 'custom');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'broken.mjs'), 'export default { id: "no-slash" };');

    const result = await loadLocalRules(projectRoot);
    expect(result.rulesAdded).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toMatch(/broken/);
  });

  it('skips the scan when disabled=true', async () => {
    const dir = join(projectRoot, '.vguard', 'rules', 'custom');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'foo.mjs'),
      `export default {
        id: 'custom/foo',
        name: 'Foo',
        description: 'd',
        severity: 'warn',
        events: ['PreToolUse'],
        match: {},
        check: () => ({ status: 'pass', ruleId: 'custom/foo' }),
      };`,
    );

    const result = await loadLocalRules(projectRoot, { disabled: true });
    expect(result.directoryExists).toBe(true);
    expect(result.rulesAdded).toBe(0);
  });
});

describe('loadLocalRulesFromPaths', () => {
  let projectRoot: string;

  beforeEach(() => {
    clearRegistry();
    projectRoot = mkdtempSync(join(tmpdir(), 'vguard-local-rule-cache-'));
  });

  afterEach(() => {
    if (existsSync(projectRoot)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('is a no-op when given an empty list', async () => {
    const result = await loadLocalRulesFromPaths(projectRoot, []);
    expect(result.rulesAdded).toBe(0);
    expect(result.directoryExists).toBe(false);
  });

  it('replays a pre-discovered path list without re-scanning the directory', async () => {
    const dir = join(projectRoot, '.vguard', 'rules', 'custom');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'foo.mjs'),
      `export default {
        id: 'custom/foo',
        name: 'Foo',
        description: 'd',
        severity: 'warn',
        events: ['PreToolUse'],
        match: {},
        check: () => ({ status: 'pass', ruleId: 'custom/foo' }),
      };`,
    );

    const result = await loadLocalRulesFromPaths(projectRoot, ['.vguard/rules/custom/foo.mjs']);
    expect(result.rulesAdded).toBe(1);
    expect(result.loaded).toContain('.vguard/rules/custom/foo.mjs');
    expect(getRule('custom/foo')).toBeDefined();
  });

  it('records stale cache entries as errors, not throws', async () => {
    const result = await loadLocalRulesFromPaths(projectRoot, ['.vguard/rules/custom/missing.mjs']);
    expect(result.rulesAdded).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toMatch(/stale cache entry/);
  });

  it('downgrades block-severity on the replay path too', async () => {
    const dir = join(projectRoot, '.vguard', 'rules', 'custom');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'strict.mjs'),
      `export default {
        id: 'custom/strict',
        name: 'Strict',
        description: 'd',
        severity: 'block',
        events: ['PreToolUse'],
        match: {},
        check: () => ({ status: 'pass', ruleId: 'custom/strict' }),
      };`,
    );

    const result = await loadLocalRulesFromPaths(projectRoot, ['.vguard/rules/custom/strict.mjs']);
    expect(result.rulesAdded).toBe(1);
    expect(result.downgraded).toHaveLength(1);
    expect(getRule('custom/strict')?.severity).toBe('warn');
  });

  it('accepts absolute paths and normalises them to project-relative labels', async () => {
    const dir = join(projectRoot, '.vguard', 'rules', 'custom');
    mkdirSync(dir, { recursive: true });
    const absPath = join(dir, 'abs.mjs');
    writeFileSync(
      absPath,
      `export default {
        id: 'custom/abs',
        name: 'Abs',
        description: 'd',
        severity: 'warn',
        events: ['PreToolUse'],
        match: {},
        check: () => ({ status: 'pass', ruleId: 'custom/abs' }),
      };`,
    );

    const result = await loadLocalRulesFromPaths(projectRoot, [absPath]);
    expect(result.rulesAdded).toBe(1);
  });
});
