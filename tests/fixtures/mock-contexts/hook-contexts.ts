import type { HookContext, HookEvent, GitContext, ResolvedConfig, ResolvedRuleConfig } from '../../../src/types.js';

/** Create a default git context for tests */
export function createGitContext(overrides: Partial<GitContext> = {}): GitContext {
  return {
    branch: 'feat/test',
    isDirty: false,
    repoRoot: '/project',
    unpushedCount: 0,
    hasRemote: false,
    ...overrides,
  };
}

/** Create a resolved config for tests */
export function createResolvedConfig(
  overrides: Partial<Omit<ResolvedConfig, 'rules'>> & { rules?: Map<string, ResolvedRuleConfig> } = {},
): ResolvedConfig {
  return {
    presets: [],
    agents: ['claude-code'],
    rules: new Map(),
    ...overrides,
  };
}

/** Create a PreToolUse hook context */
export function createPreToolUseContext(overrides: Partial<HookContext> = {}): HookContext {
  return {
    event: 'PreToolUse',
    tool: 'Edit',
    toolInput: { file_path: '/project/src/index.ts' },
    projectConfig: createResolvedConfig(),
    gitContext: createGitContext(),
    ...overrides,
  };
}

/** Create a PostToolUse hook context */
export function createPostToolUseContext(overrides: Partial<HookContext> = {}): HookContext {
  return {
    event: 'PostToolUse',
    tool: 'Edit',
    toolInput: { file_path: '/project/src/index.ts' },
    projectConfig: createResolvedConfig(),
    gitContext: createGitContext(),
    ...overrides,
  };
}

/** Create a Stop hook context */
export function createStopContext(overrides: Partial<HookContext> = {}): HookContext {
  return {
    event: 'Stop',
    tool: '',
    toolInput: {},
    projectConfig: createResolvedConfig(),
    gitContext: createGitContext(),
    ...overrides,
  };
}

/** Create a hook context for any event */
export function createHookContext(event: HookEvent, overrides: Partial<HookContext> = {}): HookContext {
  return {
    event,
    tool: 'Edit',
    toolInput: { file_path: '/project/src/index.ts' },
    projectConfig: createResolvedConfig(),
    gitContext: createGitContext(),
    ...overrides,
  };
}
