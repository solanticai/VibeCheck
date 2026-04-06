import { describe, it, expect } from 'vitest';
import { consistentReturns } from '../../../src/rules/maintainability/consistent-returns.js';
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

describe('maintainability/consistent-returns', () => {
  it('should pass when all returns have values', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/math.ts',
        content: `function abs(n: number) {\n  if (n < 0) {\n    return -n;\n  }\n  return n;\n}`,
      },
    });
    const result = consistentReturns.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when all returns are bare', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function log(msg: string) {\n  if (!msg) {\n    return;\n  }\n  console.log(msg);\n  return;\n}`,
      },
    });
    const result = consistentReturns.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn when mixing value and bare returns', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function find(items: string[], target: string) {\n  for (const item of items) {\n    if (item === target) {\n      return item;\n    }\n  }\n  return;\n}`,
      },
    });
    const result = consistentReturns.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('find');
  });

  it('should skip void-annotated functions', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function log(msg: string): void {\n  if (!msg) {\n    return;\n  }\n  console.log(msg);\n  return;\n}`,
      },
    });
    const result = consistentReturns.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should skip Promise<void> functions', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `async function save(data: string): Promise<void> {\n  if (!data) {\n    return;\n  }\n  await db.save(data);\n  return;\n}`,
      },
    });
    const result = consistentReturns.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for non-JS/TS files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/styles/globals.css',
        content: 'body { margin: 0; }',
      },
    });
    const result = consistentReturns.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/helpers.test.ts',
        content: `function helper() {\n  if (true) return 1;\n  return;\n}`,
      },
    });
    const result = consistentReturns.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/empty.ts', content: '' },
    });
    const result = consistentReturns.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function find(items: string[]) {\n  if (items.length) {\n    return items[0];\n  }\n  return;\n}`,
      },
    });
    const result = consistentReturns.check(ctx);
    expect(result.fix).toContain('return');
  });
});
