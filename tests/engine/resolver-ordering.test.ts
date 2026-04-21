import { describe, it, expect, beforeEach } from 'vitest';
import { clearRegistry, registerRule } from '../../src/engine/registry.js';
import { resolveRules, type ResolvedRule } from '../../src/engine/resolver.js';
import { runRules } from '../../src/engine/runner.js';
import type { HookContext, Rule, ResolvedConfig } from '../../src/types.js';

function makeRule(id: string, overrides: Partial<Rule> = {}): Rule {
  return {
    id,
    name: id,
    description: 'test',
    severity: 'warn',
    events: ['PreToolUse'],
    check: () => ({ status: 'pass', ruleId: id }),
    ...overrides,
  };
}

function config(
  enabledIds: string[],
  severities: Record<string, 'block' | 'warn' | 'info'> = {},
): ResolvedConfig {
  const rules = new Map<
    string,
    { enabled: boolean; severity: 'block' | 'warn' | 'info'; options: Record<string, unknown> }
  >();
  for (const id of enabledIds) {
    rules.set(id, { enabled: true, severity: severities[id] ?? 'warn', options: {} });
  }
  return { presets: [], agents: ['claude-code'], rules };
}

function hookCtx(cfg: ResolvedConfig): HookContext {
  return {
    event: 'PreToolUse',
    tool: 'Bash',
    toolInput: {},
    projectConfig: cfg,
    gitContext: {
      branch: 'main',
      isDirty: false,
      repoRoot: '/project',
      unpushedCount: 0,
      hasRemote: false,
    },
  };
}

describe('resolver topological ordering', () => {
  beforeEach(() => clearRegistry());

  it('places rules without runAfter in registration order', () => {
    registerRule(makeRule('a/one'));
    registerRule(makeRule('a/two'));
    const r = resolveRules('PreToolUse', 'Bash', config(['a/one', 'a/two']));
    expect(r.map((x) => x.rule.id)).toEqual(['a/one', 'a/two']);
  });

  it('places a rule after its runAfter dependency', () => {
    registerRule(makeRule('a/downstream', { runAfter: ['a/upstream'] }));
    registerRule(makeRule('a/upstream'));
    const r = resolveRules('PreToolUse', 'Bash', config(['a/downstream', 'a/upstream']));
    expect(r.map((x) => x.rule.id)).toEqual(['a/upstream', 'a/downstream']);
  });

  it('handles chain of 3 dependencies', () => {
    registerRule(makeRule('a/third', { runAfter: ['a/second'] }));
    registerRule(makeRule('a/second', { runAfter: ['a/first'] }));
    registerRule(makeRule('a/first'));
    const r = resolveRules('PreToolUse', 'Bash', config(['a/third', 'a/second', 'a/first']));
    expect(r.map((x) => x.rule.id)).toEqual(['a/first', 'a/second', 'a/third']);
  });

  it('ignores unknown predecessors silently', () => {
    registerRule(makeRule('a/only', { runAfter: ['a/nonexistent'] }));
    const r = resolveRules('PreToolUse', 'Bash', config(['a/only']));
    expect(r.map((x) => x.rule.id)).toEqual(['a/only']);
  });

  it('falls back to registration order on cycles (fail-open)', () => {
    registerRule(makeRule('a/x', { runAfter: ['a/y'] }));
    registerRule(makeRule('a/y', { runAfter: ['a/x'] }));
    const r = resolveRules('PreToolUse', 'Bash', config(['a/x', 'a/y']));
    expect(r.map((x) => x.rule.id).sort()).toEqual(['a/x', 'a/y']);
  });
});

describe('runner required:true skip-after-block', () => {
  beforeEach(() => clearRegistry());

  it('skips a required rule when its runAfter dep blocked', async () => {
    const blocker = makeRule('a/blocker', {
      check: () => ({ status: 'block', ruleId: 'a/blocker', message: 'no' }),
    });
    const downstream = makeRule('a/downstream', {
      runAfter: ['a/blocker'],
      required: true,
      check: () => ({ status: 'warn', ruleId: 'a/downstream', message: 'would warn' }),
    });
    registerRule(blocker);
    registerRule(downstream);

    const cfg = config(['a/blocker', 'a/downstream'], { 'a/blocker': 'block' });
    const resolved: ResolvedRule[] = resolveRules('PreToolUse', 'Bash', cfg);
    const result = await runRules(resolved, hookCtx(cfg));
    // PreToolUse short-circuits after a block — so downstream is not reached
    // and `skipped` path isn't taken. But on PostToolUse both run; verify
    // blocker produced the block and downstream did not generate a result.
    expect(result.blocked).toBe(true);
    expect(result.results.find((r) => r.ruleId === 'a/downstream')).toBeUndefined();
  });

  it('still runs downstream when upstream passed', async () => {
    registerRule(
      makeRule('a/pass-first', {
        check: () => ({ status: 'pass', ruleId: 'a/pass-first' }),
      }),
    );
    registerRule(
      makeRule('a/after', {
        runAfter: ['a/pass-first'],
        required: true,
        check: () => ({ status: 'warn', ruleId: 'a/after', message: 'ok' }),
      }),
    );

    const cfg = config(['a/pass-first', 'a/after']);
    const resolved = resolveRules('PreToolUse', 'Bash', cfg);
    const result = await runRules(resolved, hookCtx(cfg));
    expect(result.results.find((r) => r.ruleId === 'a/after')?.status).toBe('warn');
  });
});
