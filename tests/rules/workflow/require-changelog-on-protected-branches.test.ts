import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HookContext, ResolvedConfig } from '../../../src/types.js';

vi.mock('../../../src/rules/workflow/helpers/git-commit-intent.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/rules/workflow/helpers/git-commit-intent.js')
  >('../../../src/rules/workflow/helpers/git-commit-intent.js');
  return {
    ...actual,
    isInMergeCommit: vi.fn(() => false),
    getStagedFiles: vi.fn(() => [] as string[]),
  };
});

import { requireChangelogOnProtectedBranches } from '../../../src/rules/workflow/require-changelog-on-protected-branches.js';
import {
  isInMergeCommit,
  getStagedFiles,
} from '../../../src/rules/workflow/helpers/git-commit-intent.js';

const mockIsInMergeCommit = vi.mocked(isInMergeCommit);
const mockGetStagedFiles = vi.mocked(getStagedFiles);

function createContext(overrides: Partial<HookContext> = {}): HookContext {
  const defaultConfig: ResolvedConfig = {
    presets: [],
    agents: ['claude-code'],
    rules: new Map(),
  };
  return {
    event: 'PreToolUse',
    tool: 'Bash',
    toolInput: { command: 'git commit -m "msg"' },
    projectConfig: defaultConfig,
    gitContext: {
      branch: 'main',
      isDirty: true,
      repoRoot: '/project',
      unpushedCount: 0,
      hasRemote: true,
    },
    ...overrides,
  };
}

describe('workflow/require-changelog-on-protected-branches', () => {
  beforeEach(() => {
    mockIsInMergeCommit.mockReturnValue(false);
    mockGetStagedFiles.mockReturnValue([]);
  });

  it('blocks commit to main when CHANGELOG.md is not staged', () => {
    mockGetStagedFiles.mockReturnValue(['src/foo.ts']);
    const result = requireChangelogOnProtectedBranches.check(createContext());
    expect(result.status).toBe('block');
    expect(result.message).toContain('CHANGELOG.md');
    expect(result.message).toContain('main');
    expect(result.fix).toContain('CHANGELOG.md');
  });

  it('passes when CHANGELOG.md is staged', () => {
    mockGetStagedFiles.mockReturnValue(['src/foo.ts', 'CHANGELOG.md']);
    const result = requireChangelogOnProtectedBranches.check(createContext());
    expect(result.status).toBe('pass');
  });

  it('passes on non-protected branches', () => {
    const ctx = createContext({
      gitContext: {
        branch: 'feature/x',
        isDirty: true,
        repoRoot: '/project',
        unpushedCount: 0,
        hasRemote: true,
      },
    });
    mockGetStagedFiles.mockReturnValue(['src/foo.ts']);
    const result = requireChangelogOnProtectedBranches.check(ctx);
    expect(result.status).toBe('pass');
  });

  it('passes when the Bash command is not a git commit', () => {
    const ctx = createContext({ toolInput: { command: 'npm test' } });
    const result = requireChangelogOnProtectedBranches.check(ctx);
    expect(result.status).toBe('pass');
  });

  it('passes during merge commits (bypass)', () => {
    mockIsInMergeCommit.mockReturnValue(true);
    mockGetStagedFiles.mockReturnValue(['src/foo.ts']);
    const result = requireChangelogOnProtectedBranches.check(createContext());
    expect(result.status).toBe('pass');
  });

  it('respects configured branches list', () => {
    const rules = new Map();
    rules.set('workflow/require-changelog-on-protected-branches', {
      enabled: true,
      severity: 'block' as const,
      options: { branches: ['release'] },
    });
    const ctx = createContext({
      projectConfig: { presets: [], agents: ['claude-code'], rules },
      gitContext: {
        branch: 'main',
        isDirty: true,
        repoRoot: '/project',
        unpushedCount: 0,
        hasRemote: true,
      },
    });
    mockGetStagedFiles.mockReturnValue(['src/foo.ts']);
    const result = requireChangelogOnProtectedBranches.check(ctx);
    expect(result.status).toBe('pass'); // main is not in configured list
  });

  it('respects a custom changelog path', () => {
    const rules = new Map();
    rules.set('workflow/require-changelog-on-protected-branches', {
      enabled: true,
      severity: 'block' as const,
      options: { path: 'HISTORY.md' },
    });
    const ctx = createContext({
      projectConfig: { presets: [], agents: ['claude-code'], rules },
    });
    mockGetStagedFiles.mockReturnValue(['CHANGELOG.md']);
    const result = requireChangelogOnProtectedBranches.check(ctx);
    expect(result.status).toBe('block');
    expect(result.message).toContain('HISTORY.md');
  });

  it('passes when there is no repo', () => {
    const ctx = createContext({
      gitContext: {
        branch: null,
        isDirty: false,
        repoRoot: null,
        unpushedCount: 0,
        hasRemote: false,
      },
    });
    const result = requireChangelogOnProtectedBranches.check(ctx);
    expect(result.status).toBe('pass');
  });
});
