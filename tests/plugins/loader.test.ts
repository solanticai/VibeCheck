import { describe, it, expect } from 'vitest';
import { loadPlugins } from '../../src/plugins/loader.js';

// Register built-in rules
import '../../src/rules/index.js';

describe('loadPlugins', () => {
  it('should return errors for non-existent plugins', async () => {
    const result = await loadPlugins(['vibecheck-plugin-nonexistent']);
    expect(result.loaded).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].plugin).toBe('vibecheck-plugin-nonexistent');
  });

  it('should handle empty plugin list', async () => {
    const result = await loadPlugins([]);
    expect(result.loaded).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.rulesAdded).toBe(0);
    expect(result.presetsAdded).toBe(0);
  });
});
