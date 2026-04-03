import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import {
  serializeConfig,
  deserializeConfig,
  compileConfig,
  loadCompiledConfig,
} from '../../src/config/compile.js';
import type { ResolvedConfig } from '../../src/types.js';

function makeConfig(): ResolvedConfig {
  return {
    presets: ['nextjs-15'],
    agents: ['claude-code'],
    rules: new Map([
      ['security/branch-protection', { enabled: true, severity: 'block' as const, options: {} }],
      [
        'quality/import-aliases',
        { enabled: true, severity: 'warn' as const, options: { alias: '@/' } },
      ],
    ]),
  };
}

describe('serializeConfig', () => {
  it('converts ResolvedConfig to JSON-safe object', () => {
    const config = makeConfig();
    const serialized = serializeConfig(config);
    expect(serialized.presets).toEqual(['nextjs-15']);
    expect(serialized.agents).toEqual(['claude-code']);
  });

  it('converts rules Map to Record', () => {
    const config = makeConfig();
    const serialized = serializeConfig(config);
    expect(serialized.rules).not.toBeInstanceOf(Map);
    expect(serialized.rules['security/branch-protection']).toBeDefined();
    expect(serialized.rules['quality/import-aliases']).toBeDefined();
  });

  it('preserves rule options', () => {
    const config = makeConfig();
    const serialized = serializeConfig(config);
    expect(serialized.rules['quality/import-aliases'].options).toEqual({ alias: '@/' });
  });

  it('includes cloud config when present', () => {
    const config = makeConfig();
    config.cloud = { enabled: true, autoSync: true };
    const serialized = serializeConfig(config);
    expect(serialized.cloud).toEqual({ enabled: true, autoSync: true });
  });
});

describe('deserializeConfig', () => {
  it('converts JSON object back to ResolvedConfig', () => {
    const serialized = {
      presets: ['nextjs-15'],
      agents: ['claude-code'],
      rules: {
        'security/branch-protection': { enabled: true, severity: 'block' as const, options: {} },
      },
    };
    const config = deserializeConfig(serialized);
    expect(config.rules).toBeInstanceOf(Map);
    expect(config.rules.get('security/branch-protection')).toBeDefined();
  });
});

describe('compileConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes resolved-config.json to .vguard/cache/', async () => {
    const config = makeConfig();
    await compileConfig(config, '/project');

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('.vguard'), { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('resolved-config.json'),
      expect.any(String),
      'utf-8',
    );
  });

  it('returns the output path', async () => {
    const config = makeConfig();
    const path = await compileConfig(config, '/project');
    expect(path).toContain('resolved-config.json');
  });
});

describe('loadCompiledConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads and parses compiled config', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        presets: ['nextjs-15'],
        agents: ['claude-code'],
        rules: {
          'security/branch-protection': { enabled: true, severity: 'block', options: {} },
        },
      }),
    );

    const config = await loadCompiledConfig('/project');
    expect(config).not.toBeNull();
    expect(config!.rules).toBeInstanceOf(Map);
  });

  it('returns null when cache missing', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

    const config = await loadCompiledConfig('/project');
    expect(config).toBeNull();
  });
});
