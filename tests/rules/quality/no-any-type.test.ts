import { describe, it, expect } from 'vitest';
import { noAnyType } from '../../../src/rules/quality/no-any-type.js';
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
      file_path: '/project/src/utils/parser.ts',
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

describe('quality/no-any-type', () => {
  it('should pass for properly typed code', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/parser.ts',
        content: 'function parse(input: string): Record<string, unknown> { return {}; }',
      },
    });
    const result = noAnyType.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn about : any annotation', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/parser.ts',
        content: 'function parse(input: any): void {}',
      },
    });
    const result = noAnyType.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('any');
  });

  it('should warn about as any assertion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/parser.ts',
        content: 'const data = response as any;',
      },
    });
    const result = noAnyType.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
  });

  it('should warn about <any> generic', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/parser.ts',
        content: 'const items = new Map<any, string>();',
      },
    });
    const result = noAnyType.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
  });

  it('should pass for .d.ts files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/types.d.ts',
        content: 'declare function foo(x: any): void;',
      },
    });
    const result = noAnyType.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for non-TypeScript files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/parser.js',
        content: 'const x: any = 1;',
      },
    });
    const result = noAnyType.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should skip lines with eslint-disable', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/parser.ts',
        content:
          '// eslint-disable-next-line @typescript-eslint/no-explicit-any\nconst safe = true;',
      },
    });
    const result = noAnyType.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/utils/empty.ts', content: '' },
    });
    const result = noAnyType.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/parser.ts',
        content: 'const x: any = 1;',
      },
    });
    const result = noAnyType.check(ctx);
    expect(result.fix).toBeDefined();
    expect(result.fix).toContain('unknown');
  });
});
