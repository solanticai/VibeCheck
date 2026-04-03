import { describe, it, expect } from 'vitest';
import { {{RULE_VAR_NAME}} } from '../../../src/rules/{{CATEGORY}}/{{RULE_ID}}.js';
import type { HookContext, ResolvedConfig, GitContext } from '../../../src/types.js';

function createContext(overrides: Partial<HookContext> = {}): HookContext {
  return {
    event: '{{PRIMARY_EVENT}}',
    tool: '{{PRIMARY_TOOL}}',
    toolInput: {},
    projectConfig: {
      presets: [],
      agents: ['claude-code'],
      rules: new Map(),
    } as ResolvedConfig,
    gitContext: {
      branch: 'feature/test',
      isDirty: false,
      repoRoot: '/tmp/test-project',
      unpushedCount: 0,
      hasRemote: true,
    } as GitContext,
    ...overrides,
  };
}

describe('{{CATEGORY}}/{{RULE_ID}}', () => {
  it('should pass for valid input', async () => {
    const context = createContext({
      toolInput: {
        // TODO: Add valid input that should pass
      },
    });

    const result = await {{RULE_VAR_NAME}}.check(context);
    expect(result.status).toBe('pass');
  });

  it('should {{SEVERITY}} for violations', async () => {
    const context = createContext({
      toolInput: {
        // TODO: Add input that triggers a violation
      },
    });

    const result = await {{RULE_VAR_NAME}}.check(context);
    expect(result.status).toBe('{{SEVERITY}}');
    expect(result.message).toBeDefined();
  });

  it('should pass on internal errors (fail-open)', async () => {
    const context = createContext({
      toolInput: null as unknown as Record<string, unknown>,
    });

    const result = await {{RULE_VAR_NAME}}.check(context);
    expect(result.status).toBe('pass');
  });

  it('should have correct metadata', () => {
    expect({{RULE_VAR_NAME}}.id).toBe('{{CATEGORY}}/{{RULE_ID}}');
    expect({{RULE_VAR_NAME}}.severity).toBe('{{SEVERITY}}');
    expect({{RULE_VAR_NAME}}.events).toContain('{{PRIMARY_EVENT}}');
  });
});
