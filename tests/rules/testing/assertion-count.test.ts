import { describe, it, expect } from 'vitest';
import { assertionCount } from '../../../src/rules/testing/assertion-count.js';
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
      file_path: '/project/tests/utils/math.test.ts',
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

describe('testing/assertion-count', () => {
  it('should pass when all tests have assertions', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `describe('math', () => {\n  it('adds', () => {\n    expect(1 + 1).toBe(2);\n  });\n  it('subtracts', () => {\n    expect(3 - 1).toBe(2);\n  });\n});`,
      },
    });
    const result = assertionCount.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn when a test has no assertions', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `describe('math', () => {\n  it('adds', () => {\n    const result = 1 + 1;\n  });\n});`,
      },
    });
    const result = assertionCount.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('adds');
  });

  it('should detect multiple empty tests', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `it('first', () => {\n  doSomething();\n});\nit('second', () => {\n  doMore();\n});`,
      },
    });
    const result = assertionCount.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.count).toBe(2);
  });

  it('should handle test() blocks same as it()', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `test('adds', () => {\n  const result = 1 + 1;\n});`,
      },
    });
    const result = assertionCount.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('adds');
  });

  it('should pass when test() has assertions', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `test('adds', () => {\n  expect(1 + 1).toBe(2);\n});`,
      },
    });
    const result = assertionCount.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for non-test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/api.ts',
        content: `it('test', () => { doSomething(); });`,
      },
    });
    const result = assertionCount.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/tests/empty.test.ts', content: '' },
    });
    const result = assertionCount.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when no test blocks are present', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/helpers.test.ts',
        content: `function helper() { return 1; }`,
      },
    });
    const result = assertionCount.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `it('adds', () => {\n  const result = 1 + 1;\n});`,
      },
    });
    const result = assertionCount.check(ctx);
    expect(result.fix).toContain('expect()');
  });
});
