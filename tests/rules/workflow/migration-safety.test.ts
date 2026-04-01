import { describe, it, expect } from 'vitest';
import { migrationSafety } from '../../../src/rules/workflow/migration-safety.js';
import type { HookContext } from '../../../src/types.js';

function ctx(content: string, filePath = '/p/supabase/migrations/001_init.sql'): HookContext {
  return {
    event: 'PreToolUse',
    tool: 'Write',
    toolInput: { content, file_path: filePath },
    projectConfig: { presets: [], agents: ['claude-code'], rules: new Map() },
    gitContext: { branch: 'feat/test', isDirty: false, repoRoot: '/p', unpushedCount: 0, hasRemote: false },
  };
}

describe('workflow/migration-safety', () => {
  it('should warn on DROP TABLE without IF EXISTS', () => {
    const r = migrationSafety.check(ctx('-- migration\nDROP TABLE users;'));
    expect(r.status).toBe('warn');
    expect(r.message).toContain('DROP TABLE');
  });

  it('should pass on DROP TABLE IF EXISTS', () => {
    const r = migrationSafety.check(ctx('-- migration\nDROP TABLE IF EXISTS users;'));
    expect(r.status).toBe('pass');
  });

  it('should warn on DELETE without WHERE', () => {
    const r = migrationSafety.check(ctx('-- migration\nDELETE FROM users;'));
    expect(r.status).toBe('warn');
    expect(r.message).toContain('DELETE');
  });

  it('should warn on TRUNCATE TABLE', () => {
    const r = migrationSafety.check(ctx('-- migration\nTRUNCATE TABLE sessions;'));
    expect(r.status).toBe('warn');
    expect(r.message).toContain('TRUNCATE');
  });

  it('should warn on hardcoded UUIDs', () => {
    const r = migrationSafety.check(ctx('-- migration\nINSERT INTO roles (id) VALUES (\'550e8400-e29b-41d4-a716-446655440000\');'));
    expect(r.status).toBe('warn');
    expect(r.message).toContain('UUID');
  });

  it('should warn on missing header comment', () => {
    const r = migrationSafety.check(ctx('CREATE TABLE users (id int);'));
    expect(r.status).toBe('warn');
    expect(r.message).toContain('header');
  });

  it('should pass on safe SQL with header', () => {
    const r = migrationSafety.check(ctx('-- Add users table\nCREATE TABLE IF NOT EXISTS users (\n  id uuid PRIMARY KEY\n);'));
    expect(r.status).toBe('pass');
  });

  it('should skip non-SQL files', () => {
    const r = migrationSafety.check(ctx('DROP TABLE users;', '/p/src/index.ts'));
    expect(r.status).toBe('pass');
  });
});
