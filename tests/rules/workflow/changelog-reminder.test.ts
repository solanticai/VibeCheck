import { describe, it, expect } from 'vitest';
import { changelogReminder } from '../../../src/rules/workflow/changelog-reminder.js';
import type { HookContext, ResolvedConfig } from '../../../src/types.js';

function createContext(overrides: Partial<HookContext> = {}): HookContext {
  const defaultConfig: ResolvedConfig = {
    presets: [],
    agents: ['claude-code'],
    rules: new Map(),
  };

  return {
    event: 'Stop',
    tool: '',
    toolInput: {},
    projectConfig: defaultConfig,
    gitContext: {
      branch: 'feat/test',
      isDirty: true,
      repoRoot: null, // default to null so tests don't touch real filesystem
      unpushedCount: 0,
      hasRemote: false,
    },
    ...overrides,
  };
}

describe('workflow/changelog-reminder', () => {
  it('should pass when not in a git repo', () => {
    const ctx = createContext();
    const result = changelogReminder.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should have the correct rule ID', () => {
    const ctx = createContext();
    const result = changelogReminder.check(ctx);
    expect(result.ruleId).toBe('workflow/changelog-reminder');
  });

  it('should be a Stop event rule', () => {
    expect(changelogReminder.events).toContain('Stop');
  });

  it('should have info severity', () => {
    expect(changelogReminder.severity).toBe('info');
  });
});
