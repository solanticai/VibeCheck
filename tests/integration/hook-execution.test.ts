import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all external dependencies before imports
vi.mock('../../src/utils/stdin.js', () => ({
  parseStdinJson: vi.fn(),
  extractToolInput: vi.fn((data: Record<string, unknown>) => ({
    toolName: (data.tool_name as string) ?? '',
    toolInput: (data.tool_input as Record<string, unknown>) ?? {},
  })),
  extractSessionId: vi.fn((data: Record<string, unknown>) => data.session_id as string | undefined),
}));

vi.mock('../../src/config/compile.js', () => ({
  loadCompiledConfig: vi.fn(),
  loadCompiledConfigWithMetadata: vi.fn(),
  serializeConfig: vi.fn(),
  compileConfig: vi.fn(),
}));

vi.mock('../../src/engine/context.js', () => ({
  buildHookContext: vi.fn(() => ({
    event: 'PreToolUse',
    tool: 'Edit',
    toolInput: { file_path: '/project/src/index.ts' },
    projectConfig: { presets: [], agents: ['claude-code'], rules: new Map() },
    gitContext: {
      branch: 'main',
      isDirty: false,
      repoRoot: '/project',
      unpushedCount: 0,
      hasRemote: false,
    },
  })),
}));

vi.mock('../../src/engine/resolver.js', () => ({
  resolveRules: vi.fn(() => []),
}));

vi.mock('../../src/engine/runner.js', () => ({
  runRules: vi.fn(() => ({
    blocked: false,
    blockingResult: null,
    warnings: [],
    results: [],
  })),
}));

vi.mock('../../src/engine/perf.js', () => ({
  recordPerfEntry: vi.fn(),
}));

vi.mock('../../src/engine/output.js', () => ({
  formatPreToolUseOutput: vi.fn(() => ({ exitCode: 0, stderr: '', stdout: '' })),
  formatPostToolUseOutput: vi.fn(() => ({ exitCode: 0, stdout: '' })),
  formatStopOutput: vi.fn(() => ({ exitCode: 0, stderr: '' })),
}));

vi.mock('../../src/utils/validation.js', () => ({
  isValidHookEvent: vi.fn((e: string) => ['PreToolUse', 'PostToolUse', 'Stop'].includes(e)),
}));

vi.mock('../../src/utils/ignore.js', () => ({
  createIgnoreMatcher: vi.fn(() => ({
    isIgnored: vi.fn(() => false),
    patterns: [],
    filePatterns: [],
    hasFile: false,
    projectRoot: '/project',
  })),
}));

// Mock rule imports (side-effect only)
vi.mock('../../src/rules/index.js', () => ({}));

import { parseStdinJson } from '../../src/utils/stdin.js';
import { loadCompiledConfigWithMetadata } from '../../src/config/compile.js';
import { resolveRules } from '../../src/engine/resolver.js';
import { runRules } from '../../src/engine/runner.js';
import { recordPerfEntry } from '../../src/engine/perf.js';
import { formatPreToolUseOutput } from '../../src/engine/output.js';
import { createIgnoreMatcher } from '../../src/utils/ignore.js';

describe('Hook Execution Integration', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it('exits 0 on invalid stdin (fail-open)', async () => {
    vi.mocked(parseStdinJson).mockReturnValue(null);

    const { executeHook } = await import('../../src/engine/hook-entry.js');

    await expect(executeHook('PreToolUse')).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 0 when no config found (fail-open)', async () => {
    vi.mocked(parseStdinJson).mockReturnValue({ tool_name: 'Edit', tool_input: {} });
    vi.mocked(loadCompiledConfigWithMetadata).mockResolvedValue(null);

    const { executeHook } = await import('../../src/engine/hook-entry.js');

    await expect(executeHook('PreToolUse')).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 0 when tool_input.file_path matches .vguardignore', async () => {
    vi.mocked(parseStdinJson).mockReturnValue({
      tool_name: 'Edit',
      tool_input: { file_path: '/project/src/components/ui/button.tsx' },
    });
    vi.mocked(loadCompiledConfigWithMetadata).mockResolvedValue({
      config: {
        presets: [],
        agents: ['claude-code'],
        rules: new Map(),
      },
      metadata: {},
    });
    vi.mocked(createIgnoreMatcher).mockReturnValueOnce({
      isIgnored: vi.fn(() => true),
      patterns: ['src/components/ui/'],
      filePatterns: ['src/components/ui/'],
      hasFile: true,
      projectRoot: '/project',
    });

    const { executeHook } = await import('../../src/engine/hook-entry.js');
    await expect(executeHook('PreToolUse')).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(0);
    // Rule resolution / execution must be skipped.
    expect(resolveRules).not.toHaveBeenCalled();
    expect(runRules).not.toHaveBeenCalled();
    expect(recordPerfEntry).not.toHaveBeenCalled();
  });

  it('exits 0 when no matching rules', async () => {
    vi.mocked(parseStdinJson).mockReturnValue({ tool_name: 'Edit', tool_input: {} });
    vi.mocked(loadCompiledConfigWithMetadata).mockResolvedValue({
      config: {
        presets: [],
        agents: ['claude-code'],
        rules: new Map(),
      },
      metadata: {},
    });
    vi.mocked(resolveRules).mockReturnValue([]);

    const { executeHook } = await import('../../src/engine/hook-entry.js');

    await expect(executeHook('PreToolUse')).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 2 when PreToolUse rule blocks', async () => {
    vi.mocked(parseStdinJson).mockReturnValue({ tool_name: 'Edit', tool_input: {} });
    vi.mocked(loadCompiledConfigWithMetadata).mockResolvedValue({
      config: {
        presets: [],
        agents: ['claude-code'],
        rules: new Map(),
      },
      metadata: {},
    });
    vi.mocked(resolveRules).mockReturnValue([
      {
        rule: {
          id: 'security/test',
          name: 'Test',
          description: 'Test',
          severity: 'block',
          events: ['PreToolUse'],
          check: () => ({ status: 'block', ruleId: 'security/test', message: 'blocked' }),
        },
        config: { enabled: true, severity: 'block', options: {} },
      },
    ]);
    vi.mocked(runRules).mockResolvedValue({
      blocked: true,
      blockingResult: { status: 'block', ruleId: 'security/test', message: 'blocked' },
      warnings: [],
      results: [{ status: 'block', ruleId: 'security/test', message: 'blocked' }],
    });
    vi.mocked(formatPreToolUseOutput).mockReturnValue({
      exitCode: 2,
      stderr: 'BLOCKED by VGuard',
      stdout: '',
    });

    const { executeHook } = await import('../../src/engine/hook-entry.js');

    await expect(executeHook('PreToolUse')).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('records perf entry after rule execution', async () => {
    vi.mocked(parseStdinJson).mockReturnValue({ tool_name: 'Edit', tool_input: {} });
    vi.mocked(loadCompiledConfigWithMetadata).mockResolvedValue({
      config: {
        presets: [],
        agents: ['claude-code'],
        rules: new Map(),
      },
      metadata: {},
    });
    vi.mocked(resolveRules).mockReturnValue([
      {
        rule: {
          id: 'test/rule',
          name: 'Test',
          description: 'Test',
          severity: 'block',
          events: ['PreToolUse'],
          check: () => ({ status: 'pass', ruleId: 'test/rule' }),
        },
        config: { enabled: true, severity: 'block', options: {} },
      },
    ]);
    vi.mocked(runRules).mockResolvedValue({
      blocked: false,
      blockingResult: null,
      warnings: [],
      results: [{ status: 'pass', ruleId: 'test/rule' }],
    });

    const { executeHook } = await import('../../src/engine/hook-entry.js');

    try {
      await executeHook('PreToolUse');
    } catch {
      // Expected process.exit
    }

    expect(recordPerfEntry).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        event: 'PreToolUse',
        tool: 'Edit',
        ruleCount: 1,
      }),
    );
  });
});
