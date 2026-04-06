import { describe, it, expect } from 'vitest';
import { publicApiJsdoc } from '../../../src/rules/documentation/public-api-jsdoc.js';
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

describe('documentation/public-api-jsdoc', () => {
  it('should pass when all exports have JSDoc', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/math.ts',
        content: `/** Adds two numbers */\nexport function add(a: number, b: number) { return a + b; }\n\n/** Multiplies two numbers */\nexport function multiply(a: number, b: number) { return a * b; }`,
      },
    });
    const result = publicApiJsdoc.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn when multiple exports lack JSDoc', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/math.ts',
        content: `export function add(a: number, b: number) { return a + b; }\n\nexport function multiply(a: number, b: number) { return a * b; }\n\nexport function subtract(a: number, b: number) { return a - b; }`,
      },
    });
    const result = publicApiJsdoc.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.count).toBe(3);
  });

  it('should pass with only 1 undocumented export (default minUndocumented is 2)', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/math.ts',
        content: `/** Adds two numbers */\nexport function add(a: number, b: number) { return a + b; }\n\nexport function multiply(a: number, b: number) { return a * b; }`,
      },
    });
    const result = publicApiJsdoc.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should detect undocumented const exports', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/config.ts',
        content: `export const API_URL = 'https://api.example.com';\n\nexport const TIMEOUT = 5000;`,
      },
    });
    const result = publicApiJsdoc.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
  });

  it('should detect undocumented class exports', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/logger.ts',
        content: `export class Logger {\n  log(msg: string) {}\n}\n\nexport class Formatter {\n  format(msg: string) {}\n}`,
      },
    });
    const result = publicApiJsdoc.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.undocumented).toContain('Logger');
    expect(result.metadata?.undocumented).toContain('Formatter');
  });

  it('should skip index/barrel files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/index.ts',
        content: `export function add() {}\nexport function subtract() {}`,
      },
    });
    const result = publicApiJsdoc.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should skip test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/tests/math.test.ts',
        content: `export function helper() {}\nexport function fixture() {}`,
      },
    });
    const result = publicApiJsdoc.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should skip .d.ts files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/types.d.ts',
        content: `export function helper(): void;\nexport function fixture(): void;`,
      },
    });
    const result = publicApiJsdoc.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for non-JS/TS files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/styles.css',
        content: `body { margin: 0; }`,
      },
    });
    const result = publicApiJsdoc.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/empty.ts', content: '' },
    });
    const result = publicApiJsdoc.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should not require JSDoc for types by default', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/types/user.ts',
        content: `export type User = { id: string; name: string };\n\nexport interface Config { timeout: number; }`,
      },
    });
    const result = publicApiJsdoc.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/math.ts',
        content: `export function add() {}\nexport function subtract() {}`,
      },
    });
    const result = publicApiJsdoc.check(ctx);
    expect(result.fix).toContain('JSDoc');
  });
});
