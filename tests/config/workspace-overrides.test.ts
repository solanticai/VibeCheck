import { describe, it, expect } from 'vitest';
import {
  findWorkspaceOverride,
  applyWorkspaceOverride,
} from '../../src/config/workspace-overrides.js';
import type { VGuardConfig } from '../../src/types.js';

describe('findWorkspaceOverride', () => {
  it('returns null when monorepo is undefined', () => {
    expect(findWorkspaceOverride(undefined, 'apps/mobile/foo.ts')).toBeNull();
  });

  it('returns null when overrides is empty', () => {
    expect(findWorkspaceOverride({ packages: ['apps/*'] }, 'apps/mobile/foo.ts')).toBeNull();
  });

  it('returns null when filePath is undefined', () => {
    expect(
      findWorkspaceOverride(
        {
          packages: ['apps/*'],
          overrides: { 'apps/mobile': { presets: ['react-native'] } },
        },
        undefined,
      ),
    ).toBeNull();
  });

  it('matches a literal directory prefix', () => {
    const result = findWorkspaceOverride(
      {
        packages: ['apps/*'],
        overrides: { 'apps/mobile': { presets: ['react-native'] } },
      },
      'apps/mobile/src/foo.ts',
    );
    expect(result?.presets).toEqual(['react-native']);
  });

  it('matches a single-star glob', () => {
    const result = findWorkspaceOverride(
      {
        packages: ['apps/*'],
        overrides: { 'apps/*': { presets: ['web'] } },
      },
      'apps/web/foo.ts',
    );
    expect(result?.presets).toEqual(['web']);
  });

  it('prefers the most specific match (fewer wildcards)', () => {
    const result = findWorkspaceOverride(
      {
        packages: ['apps/*'],
        overrides: {
          'apps/*': { presets: ['web'] },
          'apps/mobile': { presets: ['react-native'] },
        },
      },
      'apps/mobile/foo.ts',
    );
    expect(result?.presets).toEqual(['react-native']);
  });

  it('falls back to wildcard when no literal matches', () => {
    const result = findWorkspaceOverride(
      {
        packages: ['apps/*'],
        overrides: {
          'apps/*': { presets: ['web'] },
          'apps/mobile': { presets: ['react-native'] },
        },
      },
      'apps/desktop/foo.ts',
    );
    expect(result?.presets).toEqual(['web']);
  });

  it('returns null for files outside any workspace', () => {
    const result = findWorkspaceOverride(
      {
        packages: ['apps/*'],
        overrides: { 'apps/*': { presets: ['web'] } },
      },
      'libs/shared/util.ts',
    );
    expect(result).toBeNull();
  });

  it('normalises backslash paths on Windows input', () => {
    const result = findWorkspaceOverride(
      {
        packages: ['apps/*'],
        overrides: { 'apps/mobile': { presets: ['react-native'] } },
      },
      'apps\\mobile\\foo.ts',
    );
    expect(result?.presets).toEqual(['react-native']);
  });
});

describe('applyWorkspaceOverride', () => {
  const baseConfig: VGuardConfig = {
    presets: ['typescript-strict'],
    agents: ['claude-code'],
    rules: {
      'security/branch-protection': { severity: 'block' },
    },
    monorepo: {
      packages: ['apps/*', 'libs/*'],
      overrides: {
        'apps/mobile': {
          presets: ['react-native'],
          rules: { 'security/branch-protection': { severity: 'warn' } },
        },
      },
    },
  };

  it('returns the base config when no match', () => {
    const out = applyWorkspaceOverride(baseConfig, 'libs/shared/foo.ts');
    expect(out.presets).toEqual(['typescript-strict']);
    expect(out.rules?.['security/branch-protection']).toEqual({ severity: 'block' });
  });

  it('replaces presets with the override when a match is found', () => {
    const out = applyWorkspaceOverride(baseConfig, 'apps/mobile/foo.ts');
    expect(out.presets).toEqual(['react-native']);
  });

  it('merges override rules on top of base rules', () => {
    const out = applyWorkspaceOverride(baseConfig, 'apps/mobile/foo.ts');
    expect(out.rules?.['security/branch-protection']).toEqual({ severity: 'warn' });
  });

  it('preserves non-scoped fields (agents, cloud, etc.) from the base', () => {
    const out = applyWorkspaceOverride(baseConfig, 'apps/mobile/foo.ts');
    expect(out.agents).toEqual(['claude-code']);
    expect(out.monorepo?.packages).toEqual(['apps/*', 'libs/*']);
  });
});
