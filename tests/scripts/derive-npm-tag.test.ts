import { describe, it, expect } from 'vitest';
// @ts-expect-error — pure JS helper, no declaration file
import { deriveNpmTag } from '../../scripts/derive-npm-tag.mjs';

type Derived = { npm_tag: string; is_prerelease: boolean; tag: string };

describe('deriveNpmTag — stable releases', () => {
  it.each(['1.0.0', '2.0.2', '10.20.30', '0.5.0'])('stable %s → latest', (version) => {
    const out = deriveNpmTag(version) as Derived;
    expect(out.npm_tag).toBe('latest');
    expect(out.is_prerelease).toBe(false);
    expect(out.tag).toBe(`v${version}`);
  });
});

describe('deriveNpmTag — prerelease labels', () => {
  it.each([
    ['1.0.0-alpha', 'alpha'],
    ['1.0.0-alpha.1', 'alpha'],
    ['2.0.0-beta.0', 'beta'],
    ['3.0.0-rc.5', 'rc'],
    ['1.2.3-next.4', 'next'],
    ['1.2.3-canary.0', 'canary'],
  ])('%s → %s', (version, expected) => {
    const out = deriveNpmTag(version) as Derived;
    expect(out.npm_tag).toBe(expected);
    expect(out.is_prerelease).toBe(true);
    expect(out.tag).toBe(`v${version}`);
  });

  it('unknown prerelease label falls back to "prerelease"', () => {
    const out = deriveNpmTag('1.0.0-experimental.3') as Derived;
    expect(out.npm_tag).toBe('prerelease');
    expect(out.is_prerelease).toBe(true);
  });

  it('case-insensitive label matching', () => {
    expect((deriveNpmTag('1.0.0-ALPHA.1') as Derived).npm_tag).toBe('alpha');
    expect((deriveNpmTag('1.0.0-RC.2') as Derived).npm_tag).toBe('rc');
  });
});

describe('deriveNpmTag — build metadata', () => {
  it('strips +build.x and treats as stable', () => {
    const out = deriveNpmTag('1.2.3+build.abc123') as Derived;
    expect(out.npm_tag).toBe('latest');
    expect(out.is_prerelease).toBe(false);
    expect(out.tag).toBe('v1.2.3+build.abc123');
  });

  it('strips +build from prerelease and keeps prerelease tag', () => {
    const out = deriveNpmTag('1.2.3-beta.1+build.abc') as Derived;
    expect(out.npm_tag).toBe('beta');
    expect(out.is_prerelease).toBe(true);
  });
});

describe('deriveNpmTag — errors', () => {
  it('throws on empty string', () => {
    expect(() => deriveNpmTag('')).toThrow();
  });

  it('throws on non-string', () => {
    // @ts-expect-error — intentionally wrong type
    expect(() => deriveNpmTag(null)).toThrow();
  });
});
