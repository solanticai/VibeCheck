import { describe, it, expect } from 'vitest';
import { validatePlugin } from '../../src/plugins/validator.js';
import type { VibeCheckPlugin, Rule } from '../../src/types.js';

// Register built-in rules so we can test conflict detection
import '../../src/rules/index.js';
import '../../src/presets/index.js';

function makeRule(id: string): Rule {
  return {
    id,
    name: `Test ${id}`,
    description: 'Test rule',
    severity: 'warn',
    events: ['PreToolUse'],
    match: { tools: ['Write'] },
    check: () => ({ status: 'pass', ruleId: id }),
  };
}

describe('validatePlugin', () => {
  it('should accept a valid plugin', () => {
    const plugin: VibeCheckPlugin = {
      name: 'vibecheck-plugin-test',
      version: '1.0.0',
      rules: [makeRule('test/my-rule')],
    };

    const result = validatePlugin(plugin, 'vibecheck-plugin-test');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject plugin without name', () => {
    const plugin = { version: '1.0.0', rules: [] } as unknown as VibeCheckPlugin;
    const result = validatePlugin(plugin, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('should reject plugin without version', () => {
    const plugin = { name: 'test', rules: [] } as unknown as VibeCheckPlugin;
    const result = validatePlugin(plugin, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('should reject rules that conflict with built-in rules', () => {
    const plugin: VibeCheckPlugin = {
      name: 'test',
      version: '1.0.0',
      rules: [makeRule('security/branch-protection')], // Conflicts!
    };

    const result = validatePlugin(plugin, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('conflicts'))).toBe(true);
  });

  it('should reject rules without category/name format', () => {
    const plugin: VibeCheckPlugin = {
      name: 'test',
      version: '1.0.0',
      rules: [makeRule('no-slash')], // Missing category
    };

    const result = validatePlugin(plugin, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('category/name'))).toBe(true);
  });

  it('should reject rules without check function', () => {
    const plugin: VibeCheckPlugin = {
      name: 'test',
      version: '1.0.0',
      rules: [
        {
          id: 'test/no-check',
          name: 'No Check',
          description: 'Missing check',
          severity: 'warn',
          events: ['PreToolUse'],
        } as unknown as Rule,
      ],
    };

    const result = validatePlugin(plugin, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('check'))).toBe(true);
  });

  it('should reject rules without events', () => {
    const plugin: VibeCheckPlugin = {
      name: 'test',
      version: '1.0.0',
      rules: [
        {
          id: 'test/no-events',
          name: 'No Events',
          description: 'Missing events',
          severity: 'warn',
          events: [],
          check: () => ({ status: 'pass', ruleId: 'test/no-events' }),
        },
      ],
    };

    const result = validatePlugin(plugin, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('event'))).toBe(true);
  });

  it('should reject presets that conflict with built-in presets', () => {
    const plugin: VibeCheckPlugin = {
      name: 'test',
      version: '1.0.0',
      presets: [
        {
          id: 'nextjs-15', // Conflicts!
          name: 'Next.js 15',
          description: 'Conflict',
          version: '1.0.0',
          rules: {},
        },
      ],
    };

    const result = validatePlugin(plugin, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('conflicts'))).toBe(true);
  });

  it('should warn on empty plugin (no rules or presets)', () => {
    const plugin: VibeCheckPlugin = {
      name: 'test',
      version: '1.0.0',
    };

    const result = validatePlugin(plugin, 'test');
    expect(result.valid).toBe(true); // Valid but useless
    expect(result.warnings.some((w) => w.includes('no rules or presets'))).toBe(true);
  });

  it('should accept plugin with valid presets', () => {
    const plugin: VibeCheckPlugin = {
      name: 'test',
      version: '1.0.0',
      presets: [
        {
          id: 'custom-preset',
          name: 'Custom Preset',
          description: 'Test',
          version: '1.0.0',
          rules: { 'test/my-rule': true },
        },
      ],
    };

    const result = validatePlugin(plugin, 'test');
    expect(result.valid).toBe(true);
  });
});
