import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

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

vi.mock('../../src/config/compile.js', () => ({
  compileConfig: vi.fn(),
}));

vi.mock('../../src/adapters/claude-code/adapter.js', () => ({
  claudeCodeAdapter: {
    generate: vi.fn(() =>
      Promise.resolve([
        {
          path: '.vguard/hooks/vguard-pretooluse.js',
          content: '// hook',
          mergeStrategy: 'overwrite',
        },
      ]),
    ),
  },
}));

vi.mock('../../src/adapters/cursor/adapter.js', () => ({
  cursorAdapter: { generate: vi.fn(() => Promise.resolve([])) },
}));

vi.mock('../../src/adapters/codex/adapter.js', () => ({
  codexAdapter: { generate: vi.fn(() => Promise.resolve([])) },
}));

vi.mock('../../src/adapters/opencode/adapter.js', () => ({
  openCodeAdapter: { generate: vi.fn(() => Promise.resolve([])) },
}));

vi.mock('../../src/adapters/github-actions/adapter.js', () => ({
  githubActionsAdapter: { generate: vi.fn(() => Promise.resolve([])) },
}));

vi.mock('../../src/adapters/claude-code/settings-merger.js', () => ({
  mergeSettings: vi.fn(),
}));

import { discoverConfigFile, readRawConfig } from '../../src/config/discovery.js';
import { compileConfig } from '../../src/config/compile.js';
import { claudeCodeAdapter } from '../../src/adapters/claude-code/adapter.js';
import { generateCommand } from '../../src/cli/commands/generate.js';

describe('generateCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('errors when no config found', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue(null);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    await expect(generateCommand()).rejects.toThrow('process.exit');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No VGuard config found'));

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('discovers config and generates adapter files', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    vi.mocked(readRawConfig).mockResolvedValue({ presets: ['nextjs-15'] });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await generateCommand();

    expect(compileConfig).toHaveBeenCalled();
    expect(claudeCodeAdapter.generate).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
