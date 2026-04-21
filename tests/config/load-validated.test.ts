import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/discovery.js', () => ({
  discoverConfigFile: vi.fn(),
  readRawConfig: vi.fn(),
}));

import { discoverConfigFile, readRawConfig } from '../../src/config/discovery.js';
import { loadValidatedConfig, ConfigValidationError } from '../../src/config/load-validated.js';

describe('loadValidatedConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when no config file is found', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue(null);
    await expect(loadValidatedConfig('/project')).rejects.toThrow(/No VGuard config found/);
  });

  it('returns the parsed config for a valid input', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({ path: '/p/vguard.config.ts', format: 'ts' });
    vi.mocked(readRawConfig).mockResolvedValue({
      presets: ['nextjs-15'],
      agents: ['claude-code'],
    });

    const cfg = await loadValidatedConfig('/p');
    expect(cfg.presets).toEqual(['nextjs-15']);
    expect(cfg.agents).toEqual(['claude-code']);
  });

  it('throws ConfigValidationError on a malformed config', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({ path: '/p/vguard.config.ts', format: 'ts' });
    vi.mocked(readRawConfig).mockResolvedValue({
      agents: ['not-an-agent'],
    });

    await expect(loadValidatedConfig('/p')).rejects.toThrow(ConfigValidationError);
  });

  it('produces a readable path.to.field error message', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({ path: '/p/vguard.config.ts', format: 'ts' });
    vi.mocked(readRawConfig).mockResolvedValue({
      cloud: { streaming: { batchSize: 'oops' } },
    });

    try {
      await loadValidatedConfig('/p');
      expect.fail('expected ConfigValidationError');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      const msg = (err as Error).message;
      expect(msg).toMatch(/cloud\.streaming\.batchSize/);
    }
  });

  it('rejects typos in cloud.streaming via strict schema', async () => {
    vi.mocked(discoverConfigFile).mockReturnValue({ path: '/p/vguard.config.ts', format: 'ts' });
    vi.mocked(readRawConfig).mockResolvedValue({
      cloud: { streaming: { flushInervalMs: 500 } }, // typo: flushIntervalMs
    });

    await expect(loadValidatedConfig('/p')).rejects.toThrow(ConfigValidationError);
  });
});
