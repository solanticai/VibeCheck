import { describe, it, expect } from 'vitest';
import { rlsRequired } from '../../../src/rules/security/rls-required.js';
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
    toolInput: { file_path: '/project/supabase/migrations/001_init.sql', content: '' },
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

describe('security/rls-required', () => {
  it('should pass when no CREATE TABLE statements', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/supabase/migrations/001_init.sql',
        content: 'SELECT 1;',
      },
    });
    const result = rlsRequired.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should pass when RLS is enabled for all tables', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/supabase/migrations/001_init.sql',
        content: `
          CREATE TABLE users (id UUID PRIMARY KEY);
          ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        `,
      },
    });
    const result = rlsRequired.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should warn when a table is missing RLS', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/supabase/migrations/001_init.sql',
        content: `
          CREATE TABLE users (id UUID PRIMARY KEY);
          CREATE TABLE posts (id UUID PRIMARY KEY);
          ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        `,
      },
    });
    const result = rlsRequired.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('posts');
  });

  it('should handle quoted table names', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/migrations/001.sql',
        content: `
          CREATE TABLE "user_profiles" (id UUID PRIMARY KEY);
          ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
        `,
      },
    });
    const result = rlsRequired.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should handle IF NOT EXISTS syntax', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/migrations/001.sql',
        content: `
          CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY);
        `,
      },
    });
    const result = rlsRequired.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    expect(result.message).toContain('orders');
  });

  it('should provide ALTER TABLE fix in the fix field', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/migrations/001.sql',
        content: `CREATE TABLE sessions (id UUID PRIMARY KEY);`,
      },
    });
    const result = rlsRequired.check(ctx);
    expect(result.fix).toContain('ALTER TABLE sessions ENABLE ROW LEVEL SECURITY');
  });

  it('should pass for non-SQL files', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/src/index.ts',
        content: 'CREATE TABLE fake (id INT);',
      },
    });
    const result = rlsRequired.check(ctx);
    expect(result).toHaveProperty('status', 'pass');
  });

  it('should report multiple missing tables', () => {
    const ctx = createContext({
      toolInput: {
        file_path: '/project/migrations/001.sql',
        content: `
          CREATE TABLE a (id INT);
          CREATE TABLE b (id INT);
          CREATE TABLE c (id INT);
        `,
      },
    });
    const result = rlsRequired.check(ctx);
    expect(result).toHaveProperty('status', 'warn');
    const missing = result.metadata?.missingRls as string[];
    expect(missing).toHaveLength(3);
  });
});
