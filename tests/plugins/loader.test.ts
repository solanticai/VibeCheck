import { describe, it, expect, afterEach } from 'vitest';
import { loadPlugins } from '../../src/plugins/loader.js';

// Register built-in rules
import '../../src/rules/index.js';

describe('loadPlugins', () => {
  it('should return errors for non-existent plugins', async () => {
    const result = await loadPlugins(['vguard-plugin-nonexistent']);
    expect(result.loaded).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].plugin).toBe('vguard-plugin-nonexistent');
  });

  it('should handle empty plugin list', async () => {
    const result = await loadPlugins([]);
    expect(result.loaded).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.rulesAdded).toBe(0);
    expect(result.presetsAdded).toBe(0);
  });

  describe('VGUARD_NO_PLUGINS trust-model escape hatch', () => {
    const original = process.env.VGUARD_NO_PLUGINS;

    afterEach(() => {
      if (original === undefined) delete process.env.VGUARD_NO_PLUGINS;
      else process.env.VGUARD_NO_PLUGINS = original;
    });

    it('skips plugin loading entirely when VGUARD_NO_PLUGINS=1', async () => {
      process.env.VGUARD_NO_PLUGINS = '1';
      const result = await loadPlugins(['vguard-plugin-nonexistent']);
      expect(result.loaded).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.rulesAdded).toBe(0);
      expect(result.presetsAdded).toBe(0);
    });

    it('ignores values other than exactly "1"', async () => {
      process.env.VGUARD_NO_PLUGINS = 'true';
      const result = await loadPlugins(['vguard-plugin-nonexistent']);
      expect(result.errors).toHaveLength(1);
    });
  });
});
