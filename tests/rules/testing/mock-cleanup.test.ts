import { describe, it, expect } from 'vitest';
import { mockCleanup } from '../../../src/rules/testing/mock-cleanup.js';
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

describe('testing/mock-cleanup', () => {
  it('should pass when no mocks are used', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `describe('math', () => {\n  it('adds', () => {\n    expect(1 + 1).toBe(2);\n  });\n});`,
      },
    });
    const result = mockCleanup.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when mocks have cleanup', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/api.test.ts',
        content: `vi.mock('./api');\n\nafterEach(() => {\n  vi.restoreAllMocks();\n});`,
      },
    });
    const result = mockCleanup.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn when vi.mock() has no cleanup', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/api.test.ts',
        content: `vi.mock('./api');\n\ndescribe('api', () => {\n  it('works', () => {});\n});`,
      },
    });
    const result = mockCleanup.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('cleanup');
  });

  it('should warn when jest.mock() has no cleanup', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/api.test.ts',
        content: `jest.mock('./api');\n\ndescribe('api', () => {\n  it('works', () => {});\n});`,
      },
    });
    const result = mockCleanup.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
  });

  it('should warn when vi.spyOn() has no cleanup', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/api.test.ts',
        content: `const spy = vi.spyOn(console, 'log');\n\ndescribe('logger', () => {\n  it('logs', () => {});\n});`,
      },
    });
    const result = mockCleanup.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
  });

  it('should accept resetAllMocks as cleanup', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/api.test.ts',
        content: `vi.mock('./api');\n\nafterEach(() => {\n  vi.resetAllMocks();\n});`,
      },
    });
    const result = mockCleanup.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should accept clearAllMocks as cleanup', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/api.test.ts',
        content: `vi.mock('./api');\n\nafterEach(() => {\n  vi.clearAllMocks();\n});`,
      },
    });
    const result = mockCleanup.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for non-test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/api.ts',
        content: `vi.mock('./api');`,
      },
    });
    const result = mockCleanup.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/tests/empty.test.ts', content: '' },
    });
    const result = mockCleanup.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/api.test.ts',
        content: `vi.mock('./api');`,
      },
    });
    const result = mockCleanup.check(ctx);
    expect(result.fix).toContain('afterEach');
  });
});
