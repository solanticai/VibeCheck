import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/presets/index.js', () => ({}));
vi.mock('../../src/rules/index.js', () => ({}));

vi.mock('../../src/config/discovery.js', () => ({
  discoverConfigFile: vi.fn(),
  readRawConfig: vi.fn(),
}));

vi.mock('../../src/config/presets.js', () => ({
  getAllPresets: vi.fn(() => new Map()),
}));

vi.mock('../../src/config/loader.js', () => ({
  resolveConfig: vi.fn(() => ({
    presets: [],
    agents: ['claude-code'],
    rules: new Map(),
  })),
}));

vi.mock('../../src/engine/scanner.js', () => ({
  scanProject: vi.fn(),
}));

vi.mock('../../src/cli/formatters/text.js', () => ({
  formatText: vi.fn(() => 'text output'),
}));

vi.mock('../../src/cli/formatters/json.js', () => ({
  formatJson: vi.fn(() => '[]'),
}));

vi.mock('../../src/cli/formatters/github-actions.js', () => ({
  formatGitHubActions: vi.fn(() => '::notice::No issues'),
}));

import { discoverConfigFile, readRawConfig } from '../../src/config/discovery.js';
import { scanProject } from '../../src/engine/scanner.js';
import { formatText } from '../../src/cli/formatters/text.js';
import { formatJson } from '../../src/cli/formatters/json.js';
import { formatGitHubActions } from '../../src/cli/formatters/github-actions.js';
import { lintCommand } from '../../src/cli/commands/lint.js';

describe('lintCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('errors when no config found', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue(null);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(lintCommand({})).rejects.toThrow('process.exit');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No VGuard config found'));

    errorSpy.mockRestore();
  });

  it('outputs text format by default', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    vi.mocked(readRawConfig).mockResolvedValue({});
    vi.mocked(scanProject).mockResolvedValue({
      filesScanned: 10,
      issues: [],
      hasBlockingIssues: false,
    });

    await lintCommand({});
    expect(formatText).toHaveBeenCalled();
  });

  it('outputs JSON format with --format json', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    vi.mocked(readRawConfig).mockResolvedValue({});
    vi.mocked(scanProject).mockResolvedValue({
      filesScanned: 10,
      issues: [],
      hasBlockingIssues: false,
    });

    await lintCommand({ format: 'json' });
    expect(formatJson).toHaveBeenCalled();
  });

  it('outputs GitHub Actions annotations with --format github-actions', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    vi.mocked(readRawConfig).mockResolvedValue({});
    vi.mocked(scanProject).mockResolvedValue({
      filesScanned: 10,
      issues: [],
      hasBlockingIssues: false,
    });

    await lintCommand({ format: 'github-actions' });
    expect(formatGitHubActions).toHaveBeenCalled();
  });

  it('returns non-zero exit code when blocking issues found', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    vi.mocked(readRawConfig).mockResolvedValue({});
    vi.mocked(scanProject).mockResolvedValue({
      filesScanned: 10,
      issues: [
        { ruleId: 'security/test', severity: 'block', filePath: '/src/app.ts', message: 'Bad' },
      ],
      hasBlockingIssues: true,
    });

    await expect(lintCommand({})).rejects.toThrow('process.exit');
    // LINT_BLOCKING was moved from 1 to 3 so CI can distinguish a lint
    // failure from a generic Node exception (which exits 1).
    expect(exitSpy).toHaveBeenCalledWith(3);
  });
});
