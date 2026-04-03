import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Rule, ResolvedConfig, ResolvedRuleConfig } from '../../src/types.js';

// Mock the registry module
vi.mock('../../src/engine/registry.js', () => {
  let rules = new Map<string, Rule>();
  return {
    getAllRules: () => new Map(rules),
    _setMockRules: (r: Map<string, Rule>) => {
      rules = r;
    },
  };
});

import { resolveRules } from '../../src/engine/resolver.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { _setMockRules } = (await import('../../src/engine/registry.js')) as any;

function makeRule(id: string, overrides: Partial<Rule> = {}): Rule {
  return {
    id,
    name: id,
    description: `Test rule ${id}`,
    severity: 'block',
    events: ['PreToolUse'],
    check: () => ({ status: 'pass', ruleId: id }),
    ...overrides,
  };
}

function makeConfig(rules: Record<string, Partial<ResolvedRuleConfig>> = {}): ResolvedConfig {
  const rulesMap = new Map<string, ResolvedRuleConfig>();
  for (const [id, partial] of Object.entries(rules)) {
    rulesMap.set(id, {
      enabled: true,
      severity: 'block',
      options: {},
      ...partial,
    });
  }
  return { presets: [], agents: ['claude-code'], rules: rulesMap };
}

describe('resolveRules', () => {
  beforeEach(() => {
    _setMockRules(new Map());
  });

  it('returns enabled rules matching event and tool', () => {
    const rules = new Map<string, Rule>();
    rules.set(
      'security/test',
      makeRule('security/test', {
        events: ['PreToolUse'],
        match: { tools: ['Edit'] },
      }),
    );
    _setMockRules(rules);

    const config = makeConfig({ 'security/test': { enabled: true } });
    const result = resolveRules('PreToolUse', 'Edit', config);
    expect(result).toHaveLength(1);
    expect(result[0].rule.id).toBe('security/test');
  });

  it('excludes disabled rules', () => {
    const rules = new Map<string, Rule>();
    rules.set('security/disabled', makeRule('security/disabled'));
    _setMockRules(rules);

    const config = makeConfig({ 'security/disabled': { enabled: false } });
    const result = resolveRules('PreToolUse', 'Edit', config);
    expect(result).toHaveLength(0);
  });

  it('enables security/* rules by default when no config entry', () => {
    const rules = new Map<string, Rule>();
    rules.set(
      'security/auto-enabled',
      makeRule('security/auto-enabled', {
        events: ['PreToolUse'],
      }),
    );
    _setMockRules(rules);

    // No config entry for this rule
    const config = makeConfig();
    const result = resolveRules('PreToolUse', 'Edit', config);
    expect(result).toHaveLength(1);
    expect(result[0].rule.id).toBe('security/auto-enabled');
  });

  it('disables non-security rules by default when no config entry', () => {
    const rules = new Map<string, Rule>();
    rules.set(
      'quality/not-auto',
      makeRule('quality/not-auto', {
        events: ['PreToolUse'],
      }),
    );
    _setMockRules(rules);

    const config = makeConfig();
    const result = resolveRules('PreToolUse', 'Edit', config);
    expect(result).toHaveLength(0);
  });

  it('filters by event type', () => {
    const rules = new Map<string, Rule>();
    rules.set(
      'security/pre-only',
      makeRule('security/pre-only', {
        events: ['PreToolUse'],
      }),
    );
    rules.set(
      'security/post-only',
      makeRule('security/post-only', {
        events: ['PostToolUse'],
      }),
    );
    _setMockRules(rules);

    const config = makeConfig({
      'security/pre-only': { enabled: true },
      'security/post-only': { enabled: true },
    });

    const preResult = resolveRules('PreToolUse', 'Edit', config);
    expect(preResult).toHaveLength(1);
    expect(preResult[0].rule.id).toBe('security/pre-only');

    const postResult = resolveRules('PostToolUse', 'Edit', config);
    expect(postResult).toHaveLength(1);
    expect(postResult[0].rule.id).toBe('security/post-only');
  });

  it('filters by tool matcher', () => {
    const rules = new Map<string, Rule>();
    rules.set(
      'security/bash-only',
      makeRule('security/bash-only', {
        events: ['PreToolUse'],
        match: { tools: ['Bash'] },
      }),
    );
    _setMockRules(rules);

    const config = makeConfig({ 'security/bash-only': { enabled: true } });

    expect(resolveRules('PreToolUse', 'Edit', config)).toHaveLength(0);
    expect(resolveRules('PreToolUse', 'Bash', config)).toHaveLength(1);
  });

  it('supports pipe-separated tool matchers (Edit|Write)', () => {
    const rules = new Map<string, Rule>();
    rules.set(
      'security/edit-write',
      makeRule('security/edit-write', {
        events: ['PreToolUse'],
        match: { tools: ['Edit|Write'] },
      }),
    );
    _setMockRules(rules);

    const config = makeConfig({ 'security/edit-write': { enabled: true } });

    expect(resolveRules('PreToolUse', 'Edit', config)).toHaveLength(1);
    expect(resolveRules('PreToolUse', 'Write', config)).toHaveLength(1);
    expect(resolveRules('PreToolUse', 'Bash', config)).toHaveLength(0);
  });

  it('returns rules in registration order', () => {
    const rules = new Map<string, Rule>();
    rules.set('security/first', makeRule('security/first', { events: ['PreToolUse'] }));
    rules.set('security/second', makeRule('security/second', { events: ['PreToolUse'] }));
    rules.set('security/third', makeRule('security/third', { events: ['PreToolUse'] }));
    _setMockRules(rules);

    const config = makeConfig({
      'security/first': { enabled: true },
      'security/second': { enabled: true },
      'security/third': { enabled: true },
    });

    const result = resolveRules('PreToolUse', 'Edit', config);
    expect(result.map((r) => r.rule.id)).toEqual([
      'security/first',
      'security/second',
      'security/third',
    ]);
  });

  it('returns empty array when no rules match', () => {
    _setMockRules(new Map());
    const config = makeConfig();
    const result = resolveRules('PreToolUse', 'Edit', config);
    expect(result).toHaveLength(0);
  });

  it('uses rule default severity when no config override', () => {
    const rules = new Map<string, Rule>();
    rules.set(
      'security/warn-rule',
      makeRule('security/warn-rule', {
        severity: 'warn',
        events: ['PreToolUse'],
      }),
    );
    _setMockRules(rules);

    // No config entry — default-enables security rules
    const config = makeConfig();
    const result = resolveRules('PreToolUse', 'Edit', config);
    expect(result).toHaveLength(1);
    expect(result[0].config.severity).toBe('warn');
  });

  it('applies config severity override', () => {
    const rules = new Map<string, Rule>();
    rules.set(
      'security/overridden',
      makeRule('security/overridden', {
        severity: 'block',
        events: ['PreToolUse'],
      }),
    );
    _setMockRules(rules);

    const config = makeConfig({
      'security/overridden': { enabled: true, severity: 'warn' },
    });
    const result = resolveRules('PreToolUse', 'Edit', config);
    expect(result[0].config.severity).toBe('warn');
  });

  it('passes through rules without tool matcher to all tools', () => {
    const rules = new Map<string, Rule>();
    rules.set(
      'security/any-tool',
      makeRule('security/any-tool', {
        events: ['PreToolUse'],
        // No match.tools — should match all tools
      }),
    );
    _setMockRules(rules);

    const config = makeConfig({ 'security/any-tool': { enabled: true } });

    expect(resolveRules('PreToolUse', 'Edit', config)).toHaveLength(1);
    expect(resolveRules('PreToolUse', 'Bash', config)).toHaveLength(1);
    expect(resolveRules('PreToolUse', 'Write', config)).toHaveLength(1);
  });
});
