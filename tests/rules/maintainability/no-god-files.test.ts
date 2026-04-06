import { describe, it, expect } from 'vitest';
import { noGodFiles } from '../../../src/rules/maintainability/no-god-files.js';
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

describe('maintainability/no-god-files', () => {
  it('should pass when export count is within limit', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/math.ts',
        content: `export function add() {}\nexport function subtract() {}\nexport function multiply() {}`,
      },
    });
    const result = noGodFiles.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn when export count exceeds limit', () => {
    const exports = Array.from({ length: 16 }, (_, i) => `export function fn${i}() {}`).join('\n');
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/everything.ts',
        content: exports,
      },
    });
    const result = noGodFiles.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.exportCount).toBe(16);
  });

  it('should count const, class, type, interface, enum exports', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/everything.ts',
        content: [
          'export const A = 1;',
          'export const B = 2;',
          'export const C = 3;',
          'export function fn1() {}',
          'export function fn2() {}',
          'export function fn3() {}',
          'export class Cls1 {}',
          'export class Cls2 {}',
          'export type T1 = string;',
          'export type T2 = number;',
          'export interface I1 {}',
          'export interface I2 {}',
          'export enum E1 {}',
          'export enum E2 {}',
          'export enum E3 {}',
          'export const D = 4;',
        ].join('\n'),
      },
    });
    const result = noGodFiles.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.exportCount).toBe(16);
  });

  it('should count re-exports from export { }', () => {
    const config: ResolvedConfig = {
      presets: [],
      agents: ['claude-code'],
      rules: new Map([
        ['maintainability/no-god-files', { enabled: true, severity: 'warn', options: { maxExports: 3 } }],
      ]),
    };
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: `export { a, b, c, d }`,
      },
      projectConfig: config,
    });
    const result = noGodFiles.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.metadata?.exportCount).toBe(4);
  });

  it('should skip index/barrel files', () => {
    const exports = Array.from({ length: 20 }, (_, i) => `export function fn${i}() {}`).join('\n');
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/index.ts',
        content: exports,
      },
    });
    const result = noGodFiles.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should skip .d.ts files', () => {
    const exports = Array.from({ length: 20 }, (_, i) => `export function fn${i}(): void;`).join('\n');
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/types.d.ts',
        content: exports,
      },
    });
    const result = noGodFiles.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should respect custom maxExports config', () => {
    const config: ResolvedConfig = {
      presets: [],
      agents: ['claude-code'],
      rules: new Map([
        ['maintainability/no-god-files', { enabled: true, severity: 'warn', options: { maxExports: 5 } }],
      ]),
    };
    const exports = Array.from({ length: 6 }, (_, i) => `export function fn${i}() {}`).join('\n');
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/helpers.ts',
        content: exports,
      },
      projectConfig: config,
    });
    const result = noGodFiles.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
  });

  it('should pass for non-JS/TS files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/styles/globals.css',
        content: 'body { margin: 0; }',
      },
    });
    const result = noGodFiles.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/empty.ts', content: '' },
    });
    const result = noGodFiles.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const exports = Array.from({ length: 16 }, (_, i) => `export function fn${i}() {}`).join('\n');
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/utils/everything.ts',
        content: exports,
      },
    });
    const result = noGodFiles.check(ctx);
    expect(result.fix).toContain('barrel');
  });
});
