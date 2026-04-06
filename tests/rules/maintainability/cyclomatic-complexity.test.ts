import { describe, it, expect } from 'vitest';
import { cyclomaticComplexity } from '../../../src/rules/maintainability/cyclomatic-complexity.js';
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

describe('maintainability/cyclomatic-complexity', () => {
  it('should pass for simple functions', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/math.ts',
        content: `function add(a: number, b: number) {\n  return a + b;\n}`,
      },
    });
    const result = cyclomaticComplexity.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn for complex functions', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/processor.ts',
        content: `function process(input: string) {\n  if (input === 'a') {\n    return 1;\n  } else if (input === 'b') {\n    return 2;\n  } else if (input === 'c') {\n    return 3;\n  }\n  for (const ch of input) {\n    if (ch === 'x' || ch === 'y') {\n      while (true) {\n        if (ch === 'x' && true) {\n          break;\n        } else if (ch === 'y' || false) {\n          continue;\n        }\n      }\n    }\n  }\n  return input ? 0 : -1;\n}`,
      },
    });
    const result = cyclomaticComplexity.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('process');
    expect(result.message).toContain('complexity');
  });

  it('should respect custom maxComplexity config', () => {
    const config: ResolvedConfig = {
      presets: [],
      agents: ['claude-code'],
      rules: new Map([
        ['maintainability/cyclomatic-complexity', { enabled: true, severity: 'warn', options: { maxComplexity: 2 } }],
      ]),
    };
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function check(a: boolean, b: boolean) {\n  if (a) {\n    if (b) {\n      return 'both';\n    }\n    return 'a';\n  }\n  return 'none';\n}`,
      },
      projectConfig: config,
    });
    const result = cyclomaticComplexity.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
  });

  it('should count && and || operators', () => {
    const config: ResolvedConfig = {
      presets: [],
      agents: ['claude-code'],
      rules: new Map([
        ['maintainability/cyclomatic-complexity', { enabled: true, severity: 'warn', options: { maxComplexity: 3 } }],
      ]),
    };
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function validate(a: boolean, b: boolean, c: boolean) {\n  if (a && b && c || !a) {\n    return true;\n  }\n  return false;\n}`,
      },
      projectConfig: config,
    });
    const result = cyclomaticComplexity.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
  });

  it('should pass for non-JS/TS files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/styles/globals.css',
        content: 'body { margin: 0; }',
      },
    });
    const result = cyclomaticComplexity.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/helpers.test.ts',
        content: `function complexHelper() {\n  if (a) { if (b) { if (c) { if (d) { if (e) { if (f) { if (g) { if (h) { if (i) { if (j) { return 1; }}}}}}}}}}\n  return 0;\n}`,
      },
    });
    const result = cyclomaticComplexity.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/empty.ts', content: '' },
    });
    const result = cyclomaticComplexity.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/processor.ts',
        content: `function process(input: string) {\n  if (input === 'a') {\n    return 1;\n  } else if (input === 'b') {\n    return 2;\n  } else if (input === 'c') {\n    return 3;\n  }\n  for (const ch of input) {\n    if (ch === 'x' || ch === 'y') {\n      while (true) {\n        if (ch === 'x' && true) {\n          break;\n        } else if (ch === 'y' || false) {\n          continue;\n        }\n      }\n    }\n  }\n  return input ? 0 : -1;\n}`,
      },
    });
    const result = cyclomaticComplexity.check(ctx);
    expect(result.fix).toContain('smaller');
  });

  it('should report metadata with function name and complexity', () => {
    const config: ResolvedConfig = {
      presets: [],
      agents: ['claude-code'],
      rules: new Map([
        ['maintainability/cyclomatic-complexity', { enabled: true, severity: 'warn', options: { maxComplexity: 2 } }],
      ]),
    };
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `function check(a: boolean, b: boolean) {\n  if (a) {\n    if (b) {\n      return 'both';\n    }\n  }\n  return 'none';\n}`,
      },
      projectConfig: config,
    });
    const result = cyclomaticComplexity.check(ctx);
    expect(result.metadata?.functions).toBeDefined();
    expect(result.metadata?.maxComplexity).toBe(2);
  });
});
