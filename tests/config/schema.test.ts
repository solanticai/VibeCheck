import { describe, it, expect } from 'vitest';
import {
  vguardConfigSchema,
  vibeCheckConfigSchema,
  streamingConfigSchema,
} from '../../src/config/schema.js';

describe('vguardConfigSchema', () => {
  it('validates minimal valid config', () => {
    const result = vguardConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('validates full config with all fields', () => {
    const result = vguardConfigSchema.safeParse({
      profile: 'strict',
      presets: ['nextjs-15', 'typescript-strict'],
      agents: ['claude-code', 'cursor'],
      rules: {
        'security/branch-protection': { severity: 'block', protectedBranches: ['main'] },
        'quality/import-aliases': true,
        'workflow/pr-reminder': false,
      },
      plugins: ['@anthril/vguard-plugin-custom'],
      learn: {
        enabled: true,
        scanPaths: ['src/'],
        ignorePaths: ['dist/'],
      },
      cloud: {
        enabled: true,
        projectId: 'proj_123',
        autoSync: true,
        excludePaths: ['**/*.test.ts'],
      },
      monorepo: {
        packages: ['apps/*', 'packages/*'],
        overrides: {
          'apps/web': {
            presets: ['nextjs-15'],
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('validates severity profiles', () => {
    for (const profile of ['strict', 'standard', 'relaxed', 'audit']) {
      const result = vguardConfigSchema.safeParse({ profile });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid profile', () => {
    const result = vguardConfigSchema.safeParse({ profile: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid agent types', () => {
    const result = vguardConfigSchema.safeParse({ agents: ['unknown-agent'] });
    expect(result.success).toBe(false);
  });

  it('validates rule config as boolean or object', () => {
    const result = vguardConfigSchema.safeParse({
      rules: {
        'security/test': true,
        'quality/test': { severity: 'warn' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid severity in rule config', () => {
    const result = vguardConfigSchema.safeParse({
      rules: {
        'security/test': { severity: 'invalid' },
      },
    });
    expect(result.success).toBe(false);
  });

  it('validates plugin names as valid npm packages', () => {
    const valid = vguardConfigSchema.safeParse({
      plugins: ['my-plugin', '@scope/my-plugin'],
    });
    expect(valid.success).toBe(true);

    const invalid = vguardConfigSchema.safeParse({
      plugins: ['INVALID NAME'],
    });
    expect(invalid.success).toBe(false);
  });

  describe('cloud.streaming sub-schema', () => {
    it('accepts a well-formed streaming block', () => {
      const result = vguardConfigSchema.safeParse({
        cloud: { streaming: { batchSize: 50, flushIntervalMs: 5000, timeoutMs: 2000 } },
      });
      expect(result.success).toBe(true);
    });

    it('rejects a string where a number is expected', () => {
      const result = vguardConfigSchema.safeParse({
        cloud: { streaming: { batchSize: 'oops' } },
      });
      expect(result.success).toBe(false);
    });

    it('rejects zero / negative batchSize', () => {
      expect(vguardConfigSchema.safeParse({ cloud: { streaming: { batchSize: 0 } } }).success).toBe(
        false,
      );
      expect(
        vguardConfigSchema.safeParse({ cloud: { streaming: { batchSize: -1 } } }).success,
      ).toBe(false);
    });

    it('rejects typo keys under cloud.streaming (strict schema)', () => {
      const result = vguardConfigSchema.safeParse({
        cloud: { streaming: { flushInervalMs: 500 } },
      });
      expect(result.success).toBe(false);
    });

    it('exposes streamingConfigSchema on its own', () => {
      expect(streamingConfigSchema.safeParse({ batchSize: 10 }).success).toBe(true);
    });
  });

  describe('deprecation alias', () => {
    it('vibeCheckConfigSchema still parses the same input', () => {
      expect(vibeCheckConfigSchema.safeParse({}).success).toBe(true);
    });

    it('vibeCheckConfigSchema is the same reference as vguardConfigSchema', () => {
      expect(vibeCheckConfigSchema).toBe(vguardConfigSchema);
    });
  });
});
