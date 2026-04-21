import { describe, it, expect } from 'vitest';
import { runRules } from '../../src/engine/runner.js';
import type { Rule, HookContext, ResolvedRuleConfig } from '../../src/types.js';
import type { ResolvedRule } from '../../src/engine/resolver.js';

function createContext(event: 'PreToolUse' | 'PostToolUse' | 'Stop' = 'PreToolUse'): HookContext {
  return {
    event,
    tool: 'Edit',
    toolInput: { file_path: '/project/src/index.ts' },
    projectConfig: {
      presets: [],
      agents: ['claude-code'],
      rules: new Map(),
    },
    gitContext: {
      branch: 'feat/test',
      isDirty: false,
      repoRoot: '/project',
      unpushedCount: 0,
      hasRemote: false,
    },
  };
}

function makeRule(id: string, status: 'pass' | 'block' | 'warn'): ResolvedRule {
  const rule: Rule = {
    id,
    name: id,
    description: 'Test rule',
    severity: 'block',
    events: ['PreToolUse', 'PostToolUse'],
    check: () => ({ status, ruleId: id, message: `${id} ${status}` }),
  };
  const config: ResolvedRuleConfig = { enabled: true, severity: 'block', options: {} };
  return { rule, config };
}

describe('runRules', () => {
  it('should return pass when all rules pass', async () => {
    const rules = [makeRule('rule-1', 'pass'), makeRule('rule-2', 'pass')];
    const result = await runRules(rules, createContext());
    expect(result.blocked).toBe(false);
    expect(result.blockingResult).toBeNull();
    expect(result.warnings).toHaveLength(0);
  });

  it('should short-circuit on first block for PreToolUse', async () => {
    let secondRan = false;
    const rules: ResolvedRule[] = [
      makeRule('blocker', 'block'),
      {
        rule: {
          id: 'after-block',
          name: 'After Block',
          description: 'Should not run',
          severity: 'block',
          events: ['PreToolUse'],
          check: () => {
            secondRan = true;
            return { status: 'pass', ruleId: 'after-block' };
          },
        },
        config: { enabled: true, severity: 'block', options: {} },
      },
    ];

    const result = await runRules(rules, createContext());
    expect(result.blocked).toBe(true);
    expect(result.blockingResult?.ruleId).toBe('blocker');
    expect(secondRan).toBe(false);
  });

  it('should collect warnings without blocking', async () => {
    const rules = [makeRule('warn-1', 'warn'), makeRule('warn-2', 'warn')];
    const result = await runRules(rules, createContext());
    expect(result.blocked).toBe(false);
    expect(result.warnings).toHaveLength(2);
  });

  it('should run all rules for PostToolUse even after block', async () => {
    let secondRan = false;
    const rules: ResolvedRule[] = [
      makeRule('blocker', 'block'),
      {
        rule: {
          id: 'after-block',
          name: 'After Block',
          description: 'Should still run',
          severity: 'warn',
          events: ['PostToolUse'],
          check: () => {
            secondRan = true;
            return { status: 'warn', ruleId: 'after-block', message: 'warning' };
          },
        },
        config: { enabled: true, severity: 'warn', options: {} },
      },
    ];

    await runRules(rules, createContext('PostToolUse'));
    expect(secondRan).toBe(true);
  });

  it('should fail-open on error when enforcement is "fail-open"', async () => {
    const rules: ResolvedRule[] = [
      {
        rule: {
          id: 'error-rule',
          name: 'Error Rule',
          description: 'Throws',
          severity: 'block',
          events: ['PreToolUse'],
          check: () => {
            throw new Error('Something broke');
          },
        },
        config: { enabled: true, severity: 'block', options: {} },
      },
    ];

    const ctx = createContext();
    ctx.projectConfig = { ...ctx.projectConfig, enforcement: 'fail-open' };
    const result = await runRules(rules, ctx);
    expect(result.blocked).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('Something broke');
  });

  it('should fail-closed on error for block-severity rules in "hybrid" mode (default)', async () => {
    const rules: ResolvedRule[] = [
      {
        rule: {
          id: 'error-rule',
          name: 'Error Rule',
          description: 'Throws',
          severity: 'block',
          events: ['PreToolUse'],
          check: () => {
            throw new Error('Something broke');
          },
        },
        config: { enabled: true, severity: 'block', options: {} },
      },
    ];

    // default enforcement resolves to 'hybrid'
    const result = await runRules(rules, createContext());
    expect(result.blocked).toBe(true);
    expect(result.blockingResult?.message).toContain('Something broke');
  });

  it('should fail-open on error for warn-severity rules in "hybrid" mode', async () => {
    const rules: ResolvedRule[] = [
      {
        rule: {
          id: 'advisory-rule',
          name: 'Advisory Rule',
          description: 'Throws',
          severity: 'warn',
          events: ['PreToolUse'],
          check: () => {
            throw new Error('Something broke');
          },
        },
        config: { enabled: true, severity: 'warn', options: {} },
      },
    ];

    const result = await runRules(rules, createContext());
    expect(result.blocked).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('Something broke');
  });

  it('should always block on error when enforcement is "fail-closed"', async () => {
    const rules: ResolvedRule[] = [
      {
        rule: {
          id: 'advisory-rule',
          name: 'Advisory Rule',
          description: 'Throws',
          severity: 'warn',
          events: ['PreToolUse'],
          check: () => {
            throw new Error('Something broke');
          },
        },
        config: { enabled: true, severity: 'warn', options: {} },
      },
    ];

    const ctx = createContext();
    ctx.projectConfig = { ...ctx.projectConfig, enforcement: 'fail-closed' };
    const result = await runRules(rules, ctx);
    expect(result.blocked).toBe(true);
    expect(result.blockingResult?.message).toContain('Something broke');
  });

  it('should downgrade block to warn when config severity is warn', async () => {
    const rules: ResolvedRule[] = [
      {
        rule: {
          id: 'strict-rule',
          name: 'Strict Rule',
          description: 'Blocks',
          severity: 'block',
          events: ['PreToolUse'],
          check: () => ({ status: 'block', ruleId: 'strict-rule', message: 'blocked' }),
        },
        config: { enabled: true, severity: 'warn', options: {} },
      },
    ];

    const result = await runRules(rules, createContext());
    expect(result.blocked).toBe(false);
    expect(result.warnings).toHaveLength(1);
  });
});
