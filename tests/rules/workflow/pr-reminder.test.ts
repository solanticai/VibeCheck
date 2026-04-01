import { describe, it, expect } from 'vitest';
import { prReminder } from '../../../src/rules/workflow/pr-reminder.js';
import type { HookContext, GitContext } from '../../../src/types.js';

function ctx(git: Partial<GitContext>): HookContext {
  return {
    event: 'Stop',
    tool: '',
    toolInput: {},
    projectConfig: { presets: [], agents: ['claude-code'], rules: new Map() },
    gitContext: {
      branch: 'feat/my-feature',
      isDirty: false,
      repoRoot: '/project',
      unpushedCount: 0,
      hasRemote: true,
      ...git,
    },
  };
}

describe('workflow/pr-reminder', () => {
  it('should pass when everything is clean', () => {
    const r = prReminder.check(ctx({}));
    expect(r.status).toBe('pass');
  });

  it('should warn on uncommitted changes', () => {
    const r = prReminder.check(ctx({ isDirty: true }));
    expect(r.status).toBe('warn');
    expect(r.message).toContain('Uncommitted');
  });

  it('should warn on unpushed commits', () => {
    const r = prReminder.check(ctx({ unpushedCount: 3 }));
    expect(r.status).toBe('warn');
    expect(r.message).toContain('3 unpushed');
  });

  it('should warn on untracked branch', () => {
    const r = prReminder.check(ctx({ hasRemote: false }));
    expect(r.status).toBe('warn');
    expect(r.message).toContain('no remote');
  });

  it('should pass when not in a git repo', () => {
    const r = prReminder.check(ctx({ branch: null, repoRoot: null }));
    expect(r.status).toBe('pass');
  });

  it('should suggest creating feature branch when dirty on main', () => {
    const r = prReminder.check(ctx({ branch: 'main', isDirty: true }));
    expect(r.fix).toContain('feature branch');
  });
});
