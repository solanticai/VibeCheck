import { describe, it, expect, beforeEach } from 'vitest';
import type { Rule } from '../../src/types.js';
import { clearRegistry, registerRules } from '../../src/engine/registry.js';
import { resolveRules } from '../../src/engine/resolver.js';
import { runRules } from '../../src/engine/runner.js';
import { formatPreToolUseOutput } from '../../src/engine/output.js';
import {
  createPreToolUseContext,
  createGitContext,
  createResolvedConfig,
} from '../fixtures/mock-contexts/hook-contexts.js';

// Minimal real rules for integration testing
const branchProtectionRule: Rule = {
  id: 'security/branch-protection',
  name: 'Branch Protection',
  description: 'Blocks writes to protected branches',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Edit', 'Write'] },
  check: (ctx) => {
    const protectedBranches = ['main', 'master'];
    if (ctx.gitContext.branch && protectedBranches.includes(ctx.gitContext.branch)) {
      return {
        status: 'block',
        ruleId: 'security/branch-protection',
        message: `Cannot write to protected branch "${ctx.gitContext.branch}"`,
        fix: 'Switch to a feature branch first',
      };
    }
    return { status: 'pass', ruleId: 'security/branch-protection' };
  },
};

const antiPatternsRule: Rule = {
  id: 'quality/anti-patterns',
  name: 'Anti-Patterns',
  description: 'Detects console.log and other anti-patterns',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Edit', 'Write'] },
  check: (ctx) => {
    const content = (ctx.toolInput.content as string) ?? (ctx.toolInput.new_string as string) ?? '';
    if (/console\.log\s*\(/.test(content)) {
      return {
        status: 'warn',
        ruleId: 'quality/anti-patterns',
        message: 'console.log detected — use a proper logger',
      };
    }
    return { status: 'pass', ruleId: 'quality/anti-patterns' };
  },
};

const destructiveCommandsRule: Rule = {
  id: 'security/destructive-commands',
  name: 'Destructive Commands',
  description: 'Blocks dangerous shell commands',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },
  check: (ctx) => {
    const command = (ctx.toolInput.command as string) ?? '';
    if (/rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+\/(?!\w)/.test(command)) {
      return {
        status: 'block',
        ruleId: 'security/destructive-commands',
        message: 'Blocked: rm -rf / is extremely dangerous',
      };
    }
    return { status: 'pass', ruleId: 'security/destructive-commands' };
  },
};

describe('Full Pipeline Integration', () => {
  beforeEach(() => {
    clearRegistry();
    registerRules([branchProtectionRule, antiPatternsRule, destructiveCommandsRule]);
  });

  it('blocks Write to protected branch with branch-protection rule', async () => {
    const config = createResolvedConfig({
      rules: new Map([
        ['security/branch-protection', { enabled: true, severity: 'block', options: {} }],
      ]),
    });

    const resolved = resolveRules('PreToolUse', 'Edit', config);
    expect(resolved).toHaveLength(1);

    const context = createPreToolUseContext({
      projectConfig: config,
      gitContext: createGitContext({ branch: 'main' }),
    });

    const result = await runRules(resolved, context);
    expect(result.blocked).toBe(true);
    expect(result.blockingResult?.ruleId).toBe('security/branch-protection');

    const output = formatPreToolUseOutput(result);
    expect(output.exitCode).toBe(2);
    expect(output.stderr).toContain('BLOCKED');
    expect(output.stderr).toContain('protected branch');
  });

  it('warns on console.log with anti-patterns rule', async () => {
    const config = createResolvedConfig({
      rules: new Map([['quality/anti-patterns', { enabled: true, severity: 'warn', options: {} }]]),
    });

    const resolved = resolveRules('PreToolUse', 'Write', config);
    const context = createPreToolUseContext({
      tool: 'Write',
      toolInput: { file_path: '/project/src/app.ts', content: 'console.log("debug");' },
      projectConfig: config,
      gitContext: createGitContext({ branch: 'feat/test' }),
    });

    const result = await runRules(resolved, context);
    expect(result.blocked).toBe(false);
    expect(result.warnings).toHaveLength(1);

    const output = formatPreToolUseOutput(result);
    expect(output.exitCode).toBe(0);
    expect(output.stdout).toContain('systemMessage');
  });

  it('passes clean code through all rules', async () => {
    const config = createResolvedConfig({
      rules: new Map([
        ['security/branch-protection', { enabled: true, severity: 'block', options: {} }],
        ['quality/anti-patterns', { enabled: true, severity: 'warn', options: {} }],
      ]),
    });

    const resolved = resolveRules('PreToolUse', 'Write', config);
    const context = createPreToolUseContext({
      tool: 'Write',
      toolInput: { file_path: '/project/src/app.ts', content: 'export const x = 1;' },
      projectConfig: config,
      gitContext: createGitContext({ branch: 'feat/clean' }),
    });

    const result = await runRules(resolved, context);
    expect(result.blocked).toBe(false);
    expect(result.warnings).toHaveLength(0);

    const output = formatPreToolUseOutput(result);
    expect(output.exitCode).toBe(0);
    expect(output.stdout).toBe('');
    expect(output.stderr).toBe('');
  });

  it('blocks dangerous Bash commands', async () => {
    const config = createResolvedConfig({
      rules: new Map([
        ['security/destructive-commands', { enabled: true, severity: 'block', options: {} }],
      ]),
    });

    const resolved = resolveRules('PreToolUse', 'Bash', config);
    expect(resolved).toHaveLength(1);

    const context = createPreToolUseContext({
      tool: 'Bash',
      toolInput: { command: 'rm -rf /' },
      projectConfig: config,
    });

    const result = await runRules(resolved, context);
    expect(result.blocked).toBe(true);
  });

  it('does not resolve Bash rules for Edit tool', () => {
    const config = createResolvedConfig({
      rules: new Map([
        ['security/branch-protection', { enabled: false, severity: 'block', options: {} }],
        ['security/destructive-commands', { enabled: true, severity: 'block', options: {} }],
      ]),
    });

    const resolved = resolveRules('PreToolUse', 'Edit', config);
    expect(resolved).toHaveLength(0);
  });

  it('handles multiple rules with mixed results', async () => {
    const config = createResolvedConfig({
      rules: new Map([
        ['security/branch-protection', { enabled: true, severity: 'block', options: {} }],
        ['quality/anti-patterns', { enabled: true, severity: 'warn', options: {} }],
      ]),
    });

    const resolved = resolveRules('PreToolUse', 'Write', config);
    // On feature branch, branch protection passes — only anti-patterns may warn
    const context = createPreToolUseContext({
      tool: 'Write',
      toolInput: { file_path: '/project/src/app.ts', content: 'console.log("test");' },
      projectConfig: config,
      gitContext: createGitContext({ branch: 'feat/test' }),
    });

    const result = await runRules(resolved, context);
    expect(result.blocked).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].ruleId).toBe('quality/anti-patterns');
  });
});
