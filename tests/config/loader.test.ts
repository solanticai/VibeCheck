import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../../src/config/loader.js';
import type { Preset } from '../../src/types.js';

function makePresetMap(...presets: Preset[]): Map<string, Preset> {
  return new Map(presets.map((p) => [p.id, p]));
}

const testPreset: Preset = {
  id: 'test-preset',
  name: 'Test Preset',
  description: 'Test',
  version: '1.0.0',
  rules: {
    'quality/import-aliases': { aliases: ['@/'] },
    'quality/no-deprecated-api': true,
  },
};

describe('resolveConfig', () => {
  it('should resolve an empty config with defaults', () => {
    const config = resolveConfig({});
    expect(config.presets).toEqual([]);
    expect(config.agents).toEqual(['claude-code']);
    expect(config.rules.size).toBe(0);
  });

  it('should apply preset rules', () => {
    const config = resolveConfig({ presets: ['test-preset'] }, makePresetMap(testPreset));

    expect(config.rules.has('quality/import-aliases')).toBe(true);
    expect(config.rules.get('quality/import-aliases')?.enabled).toBe(true);
    expect(config.rules.get('quality/import-aliases')?.options).toEqual({ aliases: ['@/'] });
  });

  it('should allow user to override preset rules', () => {
    const config = resolveConfig(
      {
        presets: ['test-preset'],
        rules: {
          'quality/import-aliases': { aliases: ['~/', '#/'] },
        },
      },
      makePresetMap(testPreset),
    );

    expect(config.rules.get('quality/import-aliases')?.options).toEqual({ aliases: ['~/', '#/'] });
  });

  it('should allow user to disable preset rules', () => {
    const config = resolveConfig(
      {
        presets: ['test-preset'],
        rules: { 'quality/no-deprecated-api': false },
      },
      makePresetMap(testPreset),
    );

    expect(config.rules.get('quality/no-deprecated-api')?.enabled).toBe(false);
  });

  it('should merge multiple presets (last wins)', () => {
    const preset1: Preset = {
      id: 'preset-1',
      name: 'P1',
      description: '',
      version: '1.0.0',
      rules: { 'quality/import-aliases': { severity: 'block', aliases: ['@/'] } },
    };
    const preset2: Preset = {
      id: 'preset-2',
      name: 'P2',
      description: '',
      version: '1.0.0',
      rules: { 'quality/import-aliases': { severity: 'warn', aliases: ['~/'] } },
    };

    const config = resolveConfig(
      { presets: ['preset-1', 'preset-2'] },
      makePresetMap(preset1, preset2),
    );

    // Last preset wins
    expect(config.rules.get('quality/import-aliases')?.severity).toBe('warn');
    expect(config.rules.get('quality/import-aliases')?.options).toEqual({ aliases: ['~/'] });
  });

  it('should throw on invalid config', () => {
    expect(() => resolveConfig({ agents: ['invalid-agent' as 'claude-code'] })).toThrow(
      'Invalid vibecheck config',
    );
  });

  it('should throw on unknown presets', () => {
    expect(() => resolveConfig({ presets: ['nonexistent'] }, makePresetMap(testPreset))).toThrow(
      'Unknown preset',
    );
  });

  it('should support user-only rules (no preset)', () => {
    const config = resolveConfig({
      rules: { 'custom/my-rule': { severity: 'warn' } },
    });

    expect(config.rules.has('custom/my-rule')).toBe(true);
    expect(config.rules.get('custom/my-rule')?.severity).toBe('warn');
  });
});
