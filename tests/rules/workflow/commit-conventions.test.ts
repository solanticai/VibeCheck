import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/utils/git.js', () => ({
  gitCommand: vi.fn(),
  buildGitContext: vi.fn(() => ({
    branch: 'feat/test',
    isDirty: false,
    repoRoot: '/project',
    unpushedCount: 0,
    hasRemote: false,
  })),
}));

import { gitCommand } from '../../../src/utils/git.js';
import { commitConventions } from '../../../src/rules/workflow/commit-conventions.js';
import { createStopContext } from '../../fixtures/mock-contexts/hook-contexts.js';

describe('commit-conventions rule', () => {
  it('passes valid conventional commits', () => {
    vi.mocked(gitCommand).mockReturnValue('feat: add login flow');
    const result = commitConventions.check(createStopContext());
    expect(result.status).toBe('pass');
  });

  it('passes scoped conventional commits', () => {
    vi.mocked(gitCommand).mockReturnValue('feat(auth): add OAuth support');
    const result = commitConventions.check(createStopContext());
    expect(result.status).toBe('pass');
  });

  it('passes all standard types', () => {
    const types = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
    for (const type of types) {
      vi.mocked(gitCommand).mockReturnValue(`${type}: some description`);
      const result = commitConventions.check(createStopContext());
      expect(result.status).toBe('pass');
    }
  });

  it('passes breaking change commits', () => {
    vi.mocked(gitCommand).mockReturnValue('feat!: remove deprecated API');
    const result = commitConventions.check(createStopContext());
    expect(result.status).toBe('pass');
  });

  it('warns on non-conventional commit messages', () => {
    vi.mocked(gitCommand).mockReturnValue('Updated the login page');
    const result = commitConventions.check(createStopContext());
    expect(result.status).toBe('warn');
    expect(result.message).toContain("doesn't follow conventional commit format");
  });

  it('warns on empty commit type', () => {
    vi.mocked(gitCommand).mockReturnValue(': no type here');
    const result = commitConventions.check(createStopContext());
    expect(result.status).toBe('warn');
  });

  it('passes when no commits exist', () => {
    vi.mocked(gitCommand).mockReturnValue(null as unknown as string);
    const result = commitConventions.check(createStopContext());
    expect(result.status).toBe('pass');
  });

  it('provides fix suggestion with valid types', () => {
    vi.mocked(gitCommand).mockReturnValue('bad commit message');
    const result = commitConventions.check(createStopContext());
    expect(result.fix).toContain('feat');
    expect(result.fix).toContain('fix');
  });

  it('has correct metadata', () => {
    expect(commitConventions.id).toBe('workflow/commit-conventions');
    expect(commitConventions.events).toContain('Stop');
    expect(commitConventions.severity).toBe('warn');
  });
});
