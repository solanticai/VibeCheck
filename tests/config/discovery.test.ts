import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs to control which files exist
const mockFiles = new Map<string, string>();
vi.mock('node:fs', async () => {
  return {
    existsSync: vi.fn((p: string) => mockFiles.has(p.replace(/\\/g, '/'))),
    readFileSync: vi.fn((p: string) => {
      const content = mockFiles.get(p.replace(/\\/g, '/'));
      if (!content) throw new Error('ENOENT');
      return content;
    }),
  };
});

vi.mock('node:fs/promises', async () => {
  return {
    readFile: vi.fn(async (p: string) => {
      const content = mockFiles.get(p.replace(/\\/g, '/'));
      if (!content) throw new Error('ENOENT');
      return content;
    }),
  };
});

const { discoverConfigFile, clearDiscoveryCache } = await import('../../src/config/discovery.js');

describe('config/discovery', () => {
  beforeEach(() => {
    // Discovery is memoised per-projectRoot — clear the cache between
    // tests that mutate `mockFiles` so each case sees a fresh lookup.
    clearDiscoveryCache();
    mockFiles.clear();
  });

  it('should find vguard.config.ts', () => {
    mockFiles.set('/project/vguard.config.ts', 'export default {}');
    const result = discoverConfigFile('/project');
    expect(result).not.toBeNull();
    expect(result?.format).toBe('typescript');
  });

  it('should find vguard.config.js', () => {
    mockFiles.clear();
    mockFiles.set('/project/vguard.config.js', 'module.exports = {}');
    const result = discoverConfigFile('/project');
    expect(result).not.toBeNull();
    expect(result?.format).toBe('javascript');
  });

  it('should find .vguardrc.json', () => {
    mockFiles.clear();
    mockFiles.set('/project/.vguardrc.json', '{}');
    const result = discoverConfigFile('/project');
    expect(result).not.toBeNull();
    expect(result?.format).toBe('json');
  });

  it('should find vguard field in package.json', () => {
    mockFiles.clear();
    mockFiles.set('/project/package.json', JSON.stringify({ vguard: { presets: [] } }));
    const result = discoverConfigFile('/project');
    expect(result).not.toBeNull();
    expect(result?.format).toBe('json');
  });

  it('should return null when no config exists', () => {
    mockFiles.clear();
    mockFiles.set('/project/package.json', JSON.stringify({ name: 'test' }));
    const result = discoverConfigFile('/project');
    expect(result).toBeNull();
  });

  it('should prioritize .ts over .js', () => {
    mockFiles.clear();
    mockFiles.set('/project/vguard.config.ts', 'export default {}');
    mockFiles.set('/project/vguard.config.js', 'module.exports = {}');
    const result = discoverConfigFile('/project');
    expect(result?.format).toBe('typescript');
  });
});
