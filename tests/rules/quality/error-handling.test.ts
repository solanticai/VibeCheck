import { describe, it, expect } from 'vitest';
import { errorHandling } from '../../../src/rules/quality/error-handling.js';
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
      file_path: '/project/src/services/api.ts',
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

describe('quality/error-handling', () => {
  it('should pass for proper error handling', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/services/api.ts',
        content:
          'try { await fetch(url); } catch (err) { throw new AppError("Request failed", err); }',
      },
    });
    const result = errorHandling.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn about empty catch block', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/services/api.ts',
        content: 'try { await fetch(url); } catch (err) {}',
      },
    });
    const result = errorHandling.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('Empty catch block');
  });

  it('should warn about empty catch without error param', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/services/api.ts',
        content: 'try { parse(data); } catch {}',
      },
    });
    const result = errorHandling.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
  });

  it('should warn about console-only catch', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/services/api.ts',
        content: 'try { await fetch(url); } catch (err) { console.log(err); }',
      },
    });
    const result = errorHandling.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('console.log');
  });

  it('should pass for test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/services/api.test.ts',
        content: 'try { await fn(); } catch (err) {}',
      },
    });
    const result = errorHandling.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for non-JS/TS files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/README.md',
        content: 'catch (err) {}',
      },
    });
    const result = errorHandling.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/services/empty.ts', content: '' },
    });
    const result = errorHandling.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/services/api.ts',
        content: 'try { parse(); } catch (e) {}',
      },
    });
    const result = errorHandling.check(ctx);
    expect(result.fix).toBeDefined();
  });
});
