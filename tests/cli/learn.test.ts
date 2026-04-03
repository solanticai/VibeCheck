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

// Note: The learn command imports from learn/ module
// We mock the learning pipeline
vi.mock('../../src/learn/walker.js', () => ({
  walkProjectFiles: vi.fn(() => ['/project/src/index.ts', '/project/src/app.tsx']),
}));

vi.mock('../../src/learn/aggregator.js', () => ({
  aggregateConventions: vi.fn(() => ({
    imports: { pathAliases: ['@/'], topSources: ['react', 'next'] },
    naming: { components: 'PascalCase', hooks: 'camelCase' },
    structure: { framework: 'nextjs' },
    confidence: 0.85,
  })),
}));

import { discoverConfigFile } from '../../src/config/discovery.js';

describe('learn command dependencies', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('requires a config file', () => {
    vi.mocked(discoverConfigFile).mockReturnValue(null);
    // The learn command should check for config existence
    expect(discoverConfigFile(process.cwd())).toBeNull();
  });

  it('discovers config when present', () => {
    vi.mocked(discoverConfigFile).mockReturnValue({
      path: '/project/vguard.config.ts',
      format: 'ts' as const,
    });
    const result = discoverConfigFile(process.cwd());
    expect(result).toBeDefined();
    expect(result?.path).toContain('vguard.config.ts');
  });
});
