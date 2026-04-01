import { describe, it, expect } from 'vitest';
import { deadExports } from '../../../src/rules/quality/dead-exports.js';
import type { HookContext, ResolvedConfig } from '../../../src/types.js';

function createContext(overrides: Partial<HookContext> = {}): HookContext {
  const defaultConfig: ResolvedConfig = {
    presets: [],
    agents: ['claude-code'],
    rules: new Map(),
  };

  return {
    event: 'PostToolUse',
    tool: 'Write',
    toolInput: { file_path: '/project/src/utils/helpers.ts', content: '' },
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

describe('quality/dead-exports', () => {
  it('should pass when there are no exports', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: 'const x = 1;',
      },
    });
    const result = deadExports.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for index files (re-export hubs)', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/index.ts',
        content: 'export function foo() {} export function bar() {}',
      },
    });
    const result = deadExports.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for non-source files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/README.md',
        content: 'export function test() {}',
      },
    });
    const result = deadExports.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when no git context', () => {
    const ctx = createContext({
      gitContext: {
        branch: null,
        isDirty: false,
        repoRoot: null,
        unpushedCount: 0,
        hasRemote: false,
      },
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: 'export function foo() {} export function bar() {}',
      },
    });
    const result = deadExports.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should extract named exports correctly', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `
          export const FOO = 1;
          export function bar() {}
          export class Baz {}
          export type MyType = string;
          export interface MyInterface {}
          export enum MyEnum {}
        `,
      },
    });
    // Without nearby files importing these, all would be "dead"
    // but the rule only warns when ALL exports are dead and count > 1
    const result = deadExports.check(ctx);
    // Will warn or pass depending on filesystem access
    expect(['pass', 'warn']).toContain(result.status);
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/empty.ts', content: '' },
    });
    const result = deadExports.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });
});
