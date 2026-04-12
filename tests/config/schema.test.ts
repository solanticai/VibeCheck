import { describe, it, expect } from 'vitest';
import { vibeCheckConfigSchema } from '../../src/config/schema.js';

describe('vibeCheckConfigSchema', () => {
  it('validates minimal valid config', () => {
    const result = vibeCheckConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('validates full config with all fields', () => {
    const result = vibeCheckConfigSchema.safeParse({
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
      const result = vibeCheckConfigSchema.safeParse({ profile });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid profile', () => {
    const result = vibeCheckConfigSchema.safeParse({ profile: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid agent types', () => {
    const result = vibeCheckConfigSchema.safeParse({ agents: ['unknown-agent'] });
    expect(result.success).toBe(false);
  });

  it('validates rule config as boolean or object', () => {
    const result = vibeCheckConfigSchema.safeParse({
      rules: {
        'security/test': true,
        'quality/test': { severity: 'warn' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid severity in rule config', () => {
    const result = vibeCheckConfigSchema.safeParse({
      rules: {
        'security/test': { severity: 'invalid' },
      },
    });
    expect(result.success).toBe(false);
  });

  it('validates plugin names as valid npm packages', () => {
    const valid = vibeCheckConfigSchema.safeParse({
      plugins: ['my-plugin', '@scope/my-plugin'],
    });
    expect(valid.success).toBe(true);

    const invalid = vibeCheckConfigSchema.safeParse({
      plugins: ['INVALID NAME'],
    });
    expect(invalid.success).toBe(false);
  });
});
