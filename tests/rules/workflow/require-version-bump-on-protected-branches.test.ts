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

import { requireVersionBumpOnProtectedBranches } from '../../../src/rules/workflow/require-version-bump-on-protected-branches.js';
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
    toolInput: { command: 'git commit -m "release"' },
    projectConfig: defaultConfig,
    gitContext: {
      branch: 'master',
      isDirty: true,
      repoRoot: '/project',
      unpushedCount: 0,
      hasRemote: true,
    },
    ...overrides,
  };
}

describe('workflow/require-version-bump-on-protected-branches', () => {
  beforeEach(() => {
    mockIsInMergeCommit.mockReturnValue(false);
    mockGetStagedFiles.mockReturnValue([]);
  });

  it('blocks commit to master when package.json is not staged', () => {
    mockGetStagedFiles.mockReturnValue(['src/foo.ts', 'CHANGELOG.md']);
    const result = requireVersionBumpOnProtectedBranches.check(createContext());
    expect(result.status).toBe('block');
    expect(result.message).toContain('package.json');
    expect(result.message).toContain('master');
  });

  it('passes when package.json is staged', () => {
    mockGetStagedFiles.mockReturnValue(['package.json', 'CHANGELOG.md']);
    const result = requireVersionBumpOnProtectedBranches.check(createContext());
    expect(result.status).toBe('pass');
  });

  it('defaults to only main/master (dev is not protected for version bumps)', () => {
    const ctx = createContext({
      gitContext: {
        branch: 'dev',
        isDirty: true,
        repoRoot: '/project',
        unpushedCount: 0,
        hasRemote: true,
      },
    });
    mockGetStagedFiles.mockReturnValue(['src/foo.ts']);
    const result = requireVersionBumpOnProtectedBranches.check(ctx);
    expect(result.status).toBe('pass');
  });

  it('passes when the Bash command is not a git commit', () => {
    const ctx = createContext({ toolInput: { command: 'ls -la' } });
    const result = requireVersionBumpOnProtectedBranches.check(ctx);
    expect(result.status).toBe('pass');
  });

  it('passes during merge commits', () => {
    mockIsInMergeCommit.mockReturnValue(true);
    mockGetStagedFiles.mockReturnValue(['src/foo.ts']);
    const result = requireVersionBumpOnProtectedBranches.check(createContext());
    expect(result.status).toBe('pass');
  });

  it('respects a custom packageFile', () => {
    const rules = new Map();
    rules.set('workflow/require-version-bump-on-protected-branches', {
      enabled: true,
      severity: 'block' as const,
      options: { packageFile: 'pyproject.toml' },
    });
    const ctx = createContext({
      projectConfig: { presets: [], agents: ['claude-code'], rules },
    });
    mockGetStagedFiles.mockReturnValue(['package.json']);
    const result = requireVersionBumpOnProtectedBranches.check(ctx);
    expect(result.status).toBe('block');
    expect(result.message).toContain('pyproject.toml');
  });

  it('respects a custom branches list', () => {
    const rules = new Map();
    rules.set('workflow/require-version-bump-on-protected-branches', {
      enabled: true,
      severity: 'block' as const,
      options: { branches: ['main', 'master', 'release/*'] },
    });
    const ctx = createContext({
      projectConfig: { presets: [], agents: ['claude-code'], rules },
      gitContext: {
        branch: 'release/*',
        isDirty: true,
        repoRoot: '/project',
        unpushedCount: 0,
        hasRemote: true,
      },
    });
    mockGetStagedFiles.mockReturnValue(['src/x.ts']);
    const result = requireVersionBumpOnProtectedBranches.check(ctx);
    expect(result.status).toBe('block');
  });
});
