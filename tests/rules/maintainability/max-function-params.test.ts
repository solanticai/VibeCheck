import { describe, it, expect } from 'vitest';
import { maxFunctionParams } from '../../../src/rules/maintainability/max-function-params.js';
import type { HookContext, ResolvedConfig } from '../../../src/types.js';

function createContext(overrides: Partial<HookContext> = {}): HookContext {
  const defaultConfig: ResolvedConfig = {
    presets: [],
    agents: ['claude-code'],
    rules: new Map(),
  };

  return {
    event: 'PreToolUse',
    tool: 'Write',
    toolInput: {
      file_path: '/project/src/utils/helpers.ts',
      content: '',
    },
    projectConfig: defaultConfig,
    gitContext: {
      branch: 'feat/test',
      isDirty: false,
      repoRoot: '/project',
      unpushedCount: 0,
      hasRemote: false,
    },
    ...overrides,
  };
}

describe('maintainability/max-function-params', () => {
  it('should pass when functions have 4 or fewer params', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/math.ts',
        content: `function add(a: number, b: number, c: number, d: number) {\n  return a + b + c + d;\n}`,
      },
    });
    const result = maxFunctionParams.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn when function has more than 4 params', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/math.ts',
        content: `function create(a: string, b: string, c: number, d: boolean, e: string) {\n  return { a, b, c, d, e };\n}`,
      },
    });
    const result = maxFunctionParams.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('create');
    expect(result.message).toContain('5');
  });

  it('should detect arrow functions with excess params', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `const process = (a: string, b: string, c: number, d: boolean, e: string) => {\n  return true;\n};`,
      },
    });
    const result = maxFunctionParams.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('process');
  });

  it('should count destructured params as 1', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function process({ id, name, email }: User, callback: () => void) {\n  return id;\n}`,
      },
    });
    const result = maxFunctionParams.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for zero-parameter functions', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function init() {\n  return true;\n}`,
      },
    });
    const result = maxFunctionParams.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should respect custom maxParams config', () => {
    const config: ResolvedConfig = {
      presets: [],
      agents: ['claude-code'],
      rules: new Map([
        ['maintainability/max-function-params', { enabled: true, severity: 'warn', options: { maxParams: 2 } }],
      ]),
    };
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/math.ts',
        content: `function add(a: number, b: number, c: number) {\n  return a + b + c;\n}`,
      },
      projectConfig: config,
    });
    const result = maxFunctionParams.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
  });

  it('should pass for non-JS/TS files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/styles/globals.css',
        content: 'body { margin: 0; }',
      },
    });
    const result = maxFunctionParams.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/helpers.test.ts',
        content: `function setup(a: string, b: string, c: number, d: boolean, e: string) {}`,
      },
    });
    const result = maxFunctionParams.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/empty.ts', content: '' },
    });
    const result = maxFunctionParams.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function create(a: string, b: string, c: number, d: boolean, e: string) {\n  return true;\n}`,
      },
    });
    const result = maxFunctionParams.check(ctx);
    expect(result.fix).toContain('options object');
  });
});
