import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * These tests cover the high-level contract of runGitHook(): fail-open
 * when no config exists, exit(3) on a blocking rule result, and exit(0)
 * on pass. The heavy lifting (resolver, tracker, runner) is already
 * tested in their own files — here we assert the git-hook wrapper wires
 * them together correctly.
 */

vi.mock('../../src/config/compile.js', () => ({
  loadCompiledConfigWithMetadata: vi.fn(),
}));

vi.mock('../../src/engine/resolver.js', () => ({
  resolveRules: vi.fn(() => []),
}));

vi.mock('../../src/engine/runner.js', () => ({
  runRules: vi.fn(),
}));

vi.mock('../../src/engine/tracker.js', () => ({
  recordRuleHit: vi.fn(),
}));

vi.mock('../../src/utils/git.js', () => ({
  buildGitContext: vi.fn(() => ({
    branch: 'main',
    isDirty: true,
    repoRoot: '/tmp/fake',
    unpushedCount: 0,
    hasRemote: false,
  })),
}));

vi.mock('../../src/rules/index.js', () => ({}));
vi.mock('../../src/plugins/local-rule-loader.js', () => ({
  loadLocalRules: vi.fn(),
  loadLocalRulesFromPaths: vi.fn(),
}));

import { loadCompiledConfigWithMetadata } from '../../src/config/compile.js';
import { resolveRules } from '../../src/engine/resolver.js';
import { runRules } from '../../src/engine/runner.js';
import { computeGitHookExit } from '../../src/engine/git-hook-runner.js';

describe('runGitHook', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    }) as never);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.mocked(loadCompiledConfigWithMetadata).mockReset();
    vi.mocked(resolveRules).mockReset();
    vi.mocked(runRules).mockReset();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('exits 0 when no compiled config is found (fail-open)', async () => {
    vi.mocked(loadCompiledConfigWithMetadata).mockResolvedValue(null as never);
    await expect(computeGitHookExit('git:pre-commit')).resolves.toBe(0);
  });

  it('exits 0 when no rules resolve for the event', async () => {
    vi.mocked(loadCompiledConfigWithMetadata).mockResolvedValue({
      config: { rules: new Map() } as never,
      metadata: { localRulePaths: [] } as never,
    });
    vi.mocked(resolveRules).mockReturnValue([]);
    await expect(computeGitHookExit('git:pre-commit')).resolves.toBe(0);
  });

  it('exits 3 and writes to stderr when a rule blocks', async () => {
    vi.mocked(loadCompiledConfigWithMetadata).mockResolvedValue({
      config: { rules: new Map() } as never,
      metadata: { localRulePaths: [] } as never,
    });
    vi.mocked(resolveRules).mockReturnValue([{ rule: {}, config: {} } as never]);
    vi.mocked(runRules).mockResolvedValue({
      blocked: true,
      blockingResult: {
        status: 'block',
        ruleId: 'workflow/require-changelog-on-protected-branches',
        message: 'CHANGELOG.md must be updated when committing to "main".',
        fix: 'Add an entry to CHANGELOG.md',
      },
      results: [],
      warnings: [],
    } as never);

    await expect(computeGitHookExit('git:pre-commit')).resolves.toBe(3);
    const writes = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(writes).toContain('CHANGELOG.md must be updated');
    expect(writes).toContain('workflow/require-changelog-on-protected-branches');
  });

  it('exits 0 when rules all pass', async () => {
    vi.mocked(loadCompiledConfigWithMetadata).mockResolvedValue({
      config: { rules: new Map() } as never,
      metadata: { localRulePaths: [] } as never,
    });
    vi.mocked(resolveRules).mockReturnValue([{ rule: {}, config: {} } as never]);
    vi.mocked(runRules).mockResolvedValue({
      blocked: false,
      blockingResult: null,
      results: [{ status: 'pass', ruleId: 'x' }],
      warnings: [],
    } as never);
    await expect(computeGitHookExit('git:pre-commit')).resolves.toBe(0);
  });
});
