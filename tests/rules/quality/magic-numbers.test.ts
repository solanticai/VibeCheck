import { describe, it, expect } from 'vitest';
import { magicNumbers } from '../../../src/rules/quality/magic-numbers.js';
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
      file_path: '/project/src/utils/calc.ts',
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

describe('quality/magic-numbers', () => {
  it('should pass for code with named constants', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/calc.ts',
        content: 'const MAX_RETRIES = 3;\nfor (let i = 0; i < MAX_RETRIES; i++) {}',
      },
    });
    const result = magicNumbers.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn when many magic numbers are present', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/calc.ts',
        content: 'if (x > 42) { y = 86; }\nif (z < 99) { w = 123; }\nreturn value * 7;',
      },
    });
    const result = magicNumbers.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('magic numbers');
  });

  it('should pass for allowed values (0, 1, -1, 2, 100)', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/calc.ts',
        content: 'if (x === 0) return 1;\nconst y = arr[0];\nconst pct = x * 100;',
      },
    });
    const result = magicNumbers.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/calc.test.ts',
        content: 'expect(result).toBe(42);\nexpect(other).toBe(86);\nexpect(third).toBe(99);',
      },
    });
    const result = magicNumbers.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for constant files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/constants.ts',
        content: 'export const TIMEOUT = 5000;\nexport const MAX = 42;',
      },
    });
    const result = magicNumbers.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for non-JS/TS files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/README.md',
        content: 'Use port 3000 or 8080',
      },
    });
    const result = magicNumbers.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/utils/empty.ts', content: '' },
    });
    const result = magicNumbers.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion when magic numbers detected', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/calc.ts',
        content: 'if (x > 42) { y = 86; }\nif (z < 99) { w = 123; }\nreturn value * 7;',
      },
    });
    const result = magicNumbers.check(ctx);
    expect(result.fix).toBeDefined();
    expect(result.fix).toContain('named constants');
  });
});
