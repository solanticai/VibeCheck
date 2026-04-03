import { bench, describe } from 'vitest';
import type { Rule, HookContext, ResolvedConfig } from '../../src/types.js';
import { clearRegistry, registerRules } from '../../src/engine/registry.js';
import { resolveRules } from '../../src/engine/resolver.js';
import { runRules } from '../../src/engine/runner.js';
import { serializeConfig, deserializeConfig } from '../../src/config/compile.js';

// Create test rules
function makeTestRule(id: string): Rule {
  return {
    id,
    name: id,
    description: `Test rule ${id}`,
    severity: 'block',
    events: ['PreToolUse'],
    match: { tools: ['Edit', 'Write'] },
    check: (ctx) => {
      // Simulate light work
      const content = (ctx.toolInput.content as string) ?? '';
      const hasPattern = /console\.log/.test(content);
      return {
        status: hasPattern ? 'warn' : 'pass',
        ruleId: id,
      };
    },
  };
}

function makeContext(): HookContext {
  return {
    event: 'PreToolUse',
    tool: 'Edit',
    toolInput: {
      file_path: '/project/src/components/Button.tsx',
      old_string: 'const x = 1;',
      new_string: 'const x = 2;',
    },
    projectConfig: { presets: [], agents: ['claude-code'], rules: new Map() },
    gitContext: {
      branch: 'feat/test',
      isDirty: false,
      repoRoot: '/project',
      unpushedCount: 0,
      hasRemote: false,
    },
  };
}

function makeConfig(ruleCount: number): ResolvedConfig {
  const rules = new Map<string, { enabled: boolean; severity: 'block' | 'warn' | 'info'; options: Record<string, unknown> }>();
  for (let i = 0; i < ruleCount; i++) {
    rules.set(`security/rule-${i}`, { enabled: true, severity: 'block', options: {} });
  }
  return { presets: [], agents: ['claude-code'], rules };
}

describe('Hook Execution Performance', () => {
  bench('PreToolUse hook with 5 rules', async () => {
    clearRegistry();
    const rules = Array.from({ length: 5 }, (_, i) => makeTestRule(`security/rule-${i}`));
    registerRules(rules);

    const config = makeConfig(5);
    const resolved = resolveRules('PreToolUse', 'Edit', config);
    await runRules(resolved, makeContext());
  }, { time: 2000 });

  bench('PreToolUse hook with 15 rules', async () => {
    clearRegistry();
    const rules = Array.from({ length: 15 }, (_, i) => makeTestRule(`security/rule-${i}`));
    registerRules(rules);

    const config = makeConfig(15);
    const resolved = resolveRules('PreToolUse', 'Edit', config);
    await runRules(resolved, makeContext());
  }, { time: 2000 });

  bench('Rule resolution for 25 rules', () => {
    clearRegistry();
    const rules = Array.from({ length: 25 }, (_, i) => makeTestRule(`security/rule-${i}`));
    registerRules(rules);

    const config = makeConfig(25);
    resolveRules('PreToolUse', 'Edit', config);
  }, { time: 2000 });

  bench('Config serialization roundtrip', () => {
    const config = makeConfig(20);
    const serialized = serializeConfig(config);
    deserializeConfig(serialized);
  }, { time: 2000 });
});
