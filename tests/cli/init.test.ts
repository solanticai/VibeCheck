import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => JSON.stringify({ dependencies: { next: '15.0.0' } })),
}));

vi.mock('../../src/presets/index.js', () => ({}));
vi.mock('../../src/rules/index.js', () => ({}));

vi.mock('../../src/config/presets.js', () => ({
  getAllPresets: vi.fn(
    () =>
      new Map([
        [
          'nextjs-15',
          {
            id: 'nextjs-15',
            name: 'Next.js 15',
            description: 'Next.js 15 App Router',
            version: '1.0.0',
            rules: {},
          },
        ],
        [
          'typescript-strict',
          {
            id: 'typescript-strict',
            name: 'TypeScript Strict',
            description: 'Strict TS',
            version: '1.0.0',
            rules: {},
          },
        ],
      ]),
  ),
}));

vi.mock('../../src/config/loader.js', () => ({
  resolveConfig: vi.fn(() => ({
    presets: ['nextjs-15'],
    agents: ['claude-code'],
    rules: new Map([
      ['security/branch-protection', { enabled: true, severity: 'block', options: {} }],
    ]),
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
        { path: '.claude/settings.json', content: '{"hooks":{}}', mergeStrategy: 'merge' },
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

import inquirer from 'inquirer';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { initCommand } from '../../src/cli/commands/init.js';

describe('initCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
  });

  it('detects existing config and exits early', async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('vguard.config.ts')) return true;
      return false;
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already configured'));
    consoleSpy.mockRestore();
  });

  it('writes vguard.config.ts with selected presets and agents', async () => {
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({
        presets: ['nextjs-15'],
        agents: ['claude-code'],
        protectedBranches: 'main, master',
      })
      .mockResolvedValueOnce({
        folders: ['claude-code', 'github-actions'],
      });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await initCommand();

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('vguard.config.ts'),
      expect.stringContaining('defineConfig'),
      'utf-8',
    );
    consoleSpy.mockRestore();
  });
});
