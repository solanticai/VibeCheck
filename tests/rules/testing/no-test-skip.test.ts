import { describe, it, expect } from 'vitest';
import { noTestSkip } from '../../../src/rules/testing/no-test-skip.js';
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

describe('testing/no-test-skip', () => {
  it('should pass when no skip/focus patterns are present', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `describe('math', () => {\n  it('should add', () => {\n    expect(1 + 1).toBe(2);\n  });\n});`,
      },
    });
    const result = noTestSkip.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn when .skip() is found', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `describe('math', () => {\n  it.skip('should add', () => {\n    expect(1 + 1).toBe(2);\n  });\n});`,
      },
    });
    const result = noTestSkip.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('.skip()');
  });

  it('should warn when .only() is found', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `describe('math', () => {\n  it.only('should add', () => {\n    expect(1 + 1).toBe(2);\n  });\n});`,
      },
    });
    const result = noTestSkip.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('.only()');
  });

  it('should warn when xit() is found', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `describe('math', () => {\n  xit('should add', () => {\n    expect(1 + 1).toBe(2);\n  });\n});`,
      },
    });
    const result = noTestSkip.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('xit()');
  });

  it('should warn when xdescribe() is found', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `xdescribe('math', () => {\n  it('should add', () => {\n    expect(1 + 1).toBe(2);\n  });\n});`,
      },
    });
    const result = noTestSkip.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('xdescribe()');
  });

  it('should warn when fdescribe() is found', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `fdescribe('math', () => {\n  it('should add', () => {\n    expect(1 + 1).toBe(2);\n  });\n});`,
      },
    });
    const result = noTestSkip.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('fdescribe()');
  });

  it('should detect multiple violation types', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `describe.skip('math', () => {\n  it.only('should add', () => {\n    expect(1).toBe(1);\n  });\n});`,
      },
    });
    const result = noTestSkip.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.patterns).toContain('.skip()');
    expect(result.metadata?.patterns).toContain('.only()');
  });

  it('should pass for non-test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/math.ts',
        content: `it.skip('test');`,
      },
    });
    const result = noTestSkip.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/tests/empty.test.ts', content: '' },
    });
    const result = noTestSkip.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should ignore patterns in comments', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `// it.skip('should not trigger')\ndescribe('math', () => {\n  it('should add', () => {\n    expect(1 + 1).toBe(2);\n  });\n});`,
      },
    });
    const result = noTestSkip.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `it.skip('should add', () => {});`,
      },
    });
    const result = noTestSkip.check(ctx);
    expect(result.fix).toContain('Remove');
  });
});
