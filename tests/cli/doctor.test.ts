import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

vi.mock('../../src/presets/index.js', () => ({}));
vi.mock('../../src/rules/index.js', () => ({}));

vi.mock('../../src/config/discovery.js', () => ({
  discoverConfigFile: vi.fn(),
  readRawConfig: vi.fn(),
}));

vi.mock('../../src/config/loader.js', () => ({
  resolveConfig: vi.fn(),
}));

vi.mock('../../src/config/presets.js', () => ({
  getAllPresets: vi.fn(() => new Map()),
}));

vi.mock('../../src/engine/registry.js', () => ({
  getAllRules: vi.fn(() => new Map()),
}));

vi.mock('../../src/engine/perf.js', () => ({
  readPerfEntries: vi.fn(() => []),
  calculatePerfStats: vi.fn(() => ({ p95Ms: 30, overBudgetPct: 0, count: 10 })),
  PERF_BUDGET_MS: 50,
}));

import { existsSync } from 'node:fs';
import { discoverConfigFile, readRawConfig } from '../../src/config/discovery.js';
import { resolveConfig } from '../../src/config/loader.js';
import { doctorCommand } from '../../src/cli/commands/doctor.js';

describe('doctorCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('reports fail when no config found', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue(null);

    await doctorCommand();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No VGuard config found'));
  });

  it('validates config file exists and checks rules', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    vi.mocked(readRawConfig).mockResolvedValue({ presets: [] });
    vi.mocked(resolveConfig).mockReturnValue({
      presets: [],
      agents: ['claude-code'],
      rules: new Map([
        ['security/branch-protection', { enabled: true, severity: 'block' as const, options: {} }],
      ]),
    });
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p === 'string') {
        if (p.includes('resolved-config.json')) return true;
        if (p.includes('settings.json')) return true;
        if (p.includes('.vguard/hooks')) return true;
      }
      return false;
    });

    await doctorCommand();

    // Should report passing checks
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Config file'));
  });

  it('warns when no security rules enabled', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    vi.mocked(readRawConfig).mockResolvedValue({ presets: [] });
    vi.mocked(resolveConfig).mockReturnValue({
      presets: [],
      agents: ['claude-code'],
      rules: new Map([
        ['quality/anti-patterns', { enabled: true, severity: 'warn' as const, options: {} }],
      ]),
    });

    await doctorCommand();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No security rules'));
  });

  it('warns when hooks directory missing', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    vi.mocked(readRawConfig).mockResolvedValue({ presets: [] });
    vi.mocked(resolveConfig).mockReturnValue({
      presets: [],
      agents: ['claude-code'],
      rules: new Map(),
    });
    vi.mocked(existsSync).mockReturnValue(false);

    await doctorCommand();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('settings.json'));
  });
});

// afterEach declared at wrong level, fix:
import { afterEach } from 'vitest';
