import { describe, it, expect } from 'vitest';
import { sqlInjection } from '../../../src/rules/security/sql-injection.js';
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
      file_path: '/project/src/db/queries.ts',
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

describe('security/sql-injection', () => {
  it('should pass for parameterized queries', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/db/queries.ts',
        content: 'const result = await db.query("SELECT * FROM users WHERE id = ?", [userId]);',
      },
    });
    const result = sqlInjection.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should block template literal SQL with interpolation', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/db/queries.ts',
        content: 'const result = await db.query(`SELECT * FROM users WHERE id = ${userId}`);',
      },
    });
    const result = sqlInjection.check(ctx);
    expect(result).toHaveProperty('status', 'block');
    expect(result.message).toContain('interpolation');
  });

  it('should block string concatenation in SQL', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/db/queries.ts',
        content: 'const query = "SELECT * FROM users WHERE name = \'" + userName;',
      },
    });
    const result = sqlInjection.check(ctx);
    expect(result).toHaveProperty('status', 'block');
    expect(result.message).toContain('concatenation');
  });

  it('should block Python f-string SQL', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/db/queries.py',
        content: 'cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")',
      },
    });
    const result = sqlInjection.check(ctx);
    expect(result).toHaveProperty('status', 'block');
  });

  it('should pass for test files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/db/queries.test.ts',
        content: 'const q = `SELECT * FROM users WHERE id = ${id}`;',
      },
    });
    const result = sqlInjection.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for migration files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/migrations/001_init.ts',
        content: 'const q = `SELECT * FROM users WHERE id = ${id}`;',
      },
    });
    const result = sqlInjection.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass for non-code files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/README.md',
        content: 'SELECT * FROM users WHERE id = ${id}',
      },
    });
    const result = sqlInjection.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when content is empty', () => {
    const ctx = createContext({
      toolInput: { file_path: '/project/src/db/empty.ts', content: '' },
    });
    const result = sqlInjection.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should include fix suggestion', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/db/queries.ts',
        content: 'db.query(`DELETE FROM users WHERE id = ${id}`);',
      },
    });
    const result = sqlInjection.check(ctx);
    expect(result.fix).toBeDefined();
    expect(result.fix).toContain('parameterized');
  });
});
