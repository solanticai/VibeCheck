import { describe, it, expect } from 'vitest';
import { noDeepNesting } from '../../../src/rules/maintainability/no-deep-nesting.js';
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

describe('maintainability/no-deep-nesting', () => {
  it('should pass when nesting is within limit', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function check() {\n  if (true) {\n    for (const x of items) {\n      console.log(x);\n    }\n  }\n}`,
      },
    });
    const result = noDeepNesting.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn when nesting exceeds limit', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function check() {\n  if (a) {\n    if (b) {\n      if (c) {\n        if (d) {\n          console.log('deep');\n        }\n      }\n    }\n  }\n}`,
      },
    });
    const result = noDeepNesting.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('exceeds');
  });

  it('should report correct nesting depth', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function a() {\n  if (x) {\n    for (const i of arr) {\n      if (y) {\n        try {\n          if (z) {\n            doSomething();\n          }\n        } catch (e) {}\n      }\n    }\n  }\n}`,
      },
    });
    const result = noDeepNesting.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.maxFound).toBeGreaterThan(4);
  });

  it('should respect custom maxDepth config', () => {
    const config: ResolvedConfig = {
      presets: [],
      agents: ['claude-code'],
      rules: new Map([
        ['maintainability/no-deep-nesting', { enabled: true, severity: 'warn', options: { maxDepth: 2 } }],
      ]),
    };
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function check() {\n  if (a) {\n    if (b) {\n      console.log('deep');\n    }\n  }\n}`,
      },
      projectConfig: config,
    });
    const result = noDeepNesting.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
  });

  it('should not count braces inside strings', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function check() {\n  const s = "{ { { { { }";\n  return s;\n}`,
      },
    });
    const result = noDeepNesting.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for non-JS/TS files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/styles/globals.css',
        content: 'body { margin: 0; }',
      },
    });
    const result = noDeepNesting.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/helpers.test.ts',
        content: `describe('a', () => {\n  describe('b', () => {\n    describe('c', () => {\n      describe('d', () => {\n        it('e', () => {\n          expect(true).toBe(true);\n        });\n      });\n    });\n  });\n});`,
      },
    });
    const result = noDeepNesting.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/empty.ts', content: '' },
    });
    const result = noDeepNesting.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function check() {\n  if (a) {\n    if (b) {\n      if (c) {\n        if (d) {\n          console.log('deep');\n        }\n      }\n    }\n  }\n}`,
      },
    });
    const result = noDeepNesting.check(ctx);
    expect(result.fix).toContain('early returns');
  });
});
