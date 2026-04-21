import { describe, it, expect } from 'vitest';
import {
  findWorkspaceOverride,
  applyWorkspaceOverride,
  buildWorkspaceGlobRegex,
  __testGetCompileCount,
} from '../../src/config/workspace-overrides.js';
import type { MonorepoConfig, VGuardConfig } from '../../src/types.js';

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

describe('buildWorkspaceGlobRegex', () => {
  it('anchors the regex (no partial-prefix matches)', () => {
    const re = buildWorkspaceGlobRegex('apps/mobile');
    expect(re.test('apps/mobile')).toBe(true);
    expect(re.test('apps/mobile/foo.ts')).toBe(true);
    expect(re.test('libs/apps/mobile')).toBe(false);
  });

  it('escapes regex metacharacters in literal segments', () => {
    const re = buildWorkspaceGlobRegex('apps/my-app.v1');
    expect(re.test('apps/my-app.v1/foo.ts')).toBe(true);
    // The dot would match any char if not escaped — this confirms the escape.
    expect(re.test('apps/myXapp.v1/foo.ts')).toBe(false);
  });

  it('treats ** as recursive wildcard', () => {
    const re = buildWorkspaceGlobRegex('apps/**');
    expect(re.test('apps/mobile/nested/deep.ts')).toBe(true);
    expect(re.test('libs/mobile')).toBe(false);
  });
});

describe('matcher compilation is cached per MonorepoConfig reference', () => {
  it('reuses compiled matchers across repeat lookups on the same config', () => {
    const monorepo: MonorepoConfig = {
      packages: ['apps/*'],
      overrides: {
        'apps/mobile': { presets: ['react-native'] },
        'apps/web': { presets: ['web'] },
      },
    };

    const before = __testGetCompileCount();

    findWorkspaceOverride(monorepo, 'apps/mobile/a.ts');
    const afterFirst = __testGetCompileCount();

    findWorkspaceOverride(monorepo, 'apps/mobile/b.ts');
    findWorkspaceOverride(monorepo, 'apps/web/c.ts');
    findWorkspaceOverride(monorepo, 'libs/d.ts');
    const afterRepeats = __testGetCompileCount();

    // First call compiled once.
    expect(afterFirst - before).toBe(1);
    // Repeat calls against the same reference add zero compilations.
    expect(afterRepeats - afterFirst).toBe(0);
  });

  it('compiles separately for distinct MonorepoConfig references', () => {
    const makeConfig = (): MonorepoConfig => ({
      packages: ['apps/*'],
      overrides: { 'apps/mobile': { presets: ['react-native'] } },
    });

    const before = __testGetCompileCount();

    findWorkspaceOverride(makeConfig(), 'apps/mobile/foo.ts');
    const afterA = __testGetCompileCount();

    findWorkspaceOverride(makeConfig(), 'apps/mobile/foo.ts');
    const afterB = __testGetCompileCount();

    // Each fresh object got its own compilation pass.
    expect(afterA - before).toBe(1);
    expect(afterB - afterA).toBe(1);
  });
});
