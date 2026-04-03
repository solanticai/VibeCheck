import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
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
    rules: new Map([
      ['security/branch-protection', { enabled: true, severity: 'block', options: {} }],
    ]),
  })),
}));

vi.mock('../../src/config/compile.js', () => ({
  serializeConfig: vi.fn(() => ({
    presets: [],
    agents: ['claude-code'],
    rules: { 'security/branch-protection': { enabled: true, severity: 'block', options: {} } },
  })),
}));

vi.mock('../../src/eject/bundler.js', () => ({
  bundleHookScript: vi.fn(() => '#!/usr/bin/env node\n// mock hook script'),
}));

import { writeFile, mkdir } from 'node:fs/promises';
import { discoverConfigFile, readRawConfig } from '../../src/config/discovery.js';
import { bundleHookScript } from '../../src/eject/bundler.js';
import { ejectCommand } from '../../src/cli/commands/eject.js';

describe('ejectCommand', () => {
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

  it('exits with error when no config found', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue(null);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(ejectCommand()).rejects.toThrow('process.exit');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No VGuard config found'));

    errorSpy.mockRestore();
  });

  it('generates 3 hook scripts (PreToolUse, PostToolUse, Stop)', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    vi.mocked(readRawConfig).mockResolvedValue({ presets: [] });

    await ejectCommand();

    expect(bundleHookScript).toHaveBeenCalledTimes(3);
    expect(bundleHookScript).toHaveBeenCalledWith('PreToolUse', expect.any(Object));
    expect(bundleHookScript).toHaveBeenCalledWith('PostToolUse', expect.any(Object));
    expect(bundleHookScript).toHaveBeenCalledWith('Stop', expect.any(Object));
  });

  it('writes frozen-config.json', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    vi.mocked(readRawConfig).mockResolvedValue({ presets: [] });

    await ejectCommand();

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('frozen-config.json'),
      expect.any(String),
      'utf-8',
    );
  });

  it('writes VGUARD-EJECTED.md readme', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    vi.mocked(readRawConfig).mockResolvedValue({ presets: [] });

    await ejectCommand();

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('VGUARD-EJECTED.md'),
      expect.stringContaining('VGuard'),
      'utf-8',
    );
  });

  it('creates output directories', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    vi.mocked(readRawConfig).mockResolvedValue({ presets: [] });

    await ejectCommand();

    expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });
});
