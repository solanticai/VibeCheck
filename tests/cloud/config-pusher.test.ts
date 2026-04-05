import { describe, it, expect } from 'vitest';
import { buildPayload, hashPayload } from '../../src/cloud/config-pusher.js';

describe('config-pusher payload building', () => {
  it('builds a minimal payload', () => {
    const payload = buildPayload(
      {
        presets: ['nextjs-15'],
        agents: ['claude-code'],
        rules: {
          'security/branch-protection': { enabled: true, severity: 'block' },
        },
        resolvedAt: '2026-04-05T00:00:00.000Z',
      },
      '1.4.0',
    );

    expect(payload.vguardVersion).toBe('1.4.0');
    expect(payload.configSnapshot.presets).toEqual(['nextjs-15']);
    expect(payload.configSnapshot.agents).toEqual(['claude-code']);
    expect(payload.configSnapshot.rules['security/branch-protection']).toEqual({
      enabled: true,
      severity: 'block',
      options: undefined,
    });
    expect(payload.configSnapshot.resolvedAt).toBe('2026-04-05T00:00:00.000Z');
  });

  it('defaults missing severity to warn and treats undefined enabled as true', () => {
    const payload = buildPayload(
      {
        rules: {
          'x/foo': {},
          'x/bar': { enabled: false },
        },
      },
      '1.4.0',
    );
    expect(payload.configSnapshot.rules['x/foo'].severity).toBe('warn');
    expect(payload.configSnapshot.rules['x/foo'].enabled).toBe(true);
    expect(payload.configSnapshot.rules['x/bar'].enabled).toBe(false);
  });

  it('includes language + framework only when present', () => {
    const withBoth = buildPayload({ language: 'typescript', framework: 'nextjs-15' }, '1.4.0');
    expect(withBoth.language).toBe('typescript');
    expect(withBoth.framework).toBe('nextjs-15');

    const withoutAny = buildPayload({}, '1.4.0');
    expect(withoutAny.language).toBeUndefined();
    expect(withoutAny.framework).toBeUndefined();
  });

  it('preserves resolvedAt from the resolved file', () => {
    const payload = buildPayload({ resolvedAt: '2020-01-01T00:00:00.000Z' }, '1.4.0');
    expect(payload.configSnapshot.resolvedAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('falls back to now() for resolvedAt when missing', () => {
    const before = Date.now();
    const payload = buildPayload({}, '1.4.0');
    const after = Date.now();
    const parsed = new Date(payload.configSnapshot.resolvedAt).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });
});

describe('config-pusher hash stability', () => {
  const basePayload = buildPayload(
    {
      presets: ['a', 'b'],
      agents: ['claude-code'],
      rules: { 'x/foo': { enabled: true, severity: 'warn' } },
      resolvedAt: '2026-04-05T00:00:00.000Z',
    },
    '1.4.0',
  );

  it('returns the same hash for identical payloads', () => {
    const clone = buildPayload(
      {
        presets: ['a', 'b'],
        agents: ['claude-code'],
        rules: { 'x/foo': { enabled: true, severity: 'warn' } },
        resolvedAt: '2026-04-05T00:00:00.000Z',
      },
      '1.4.0',
    );
    expect(hashPayload(clone)).toBe(hashPayload(basePayload));
  });

  it('changes hash when vguard version changes', () => {
    const bumped = buildPayload(
      {
        presets: ['a', 'b'],
        agents: ['claude-code'],
        rules: { 'x/foo': { enabled: true, severity: 'warn' } },
        resolvedAt: '2026-04-05T00:00:00.000Z',
      },
      '1.4.1',
    );
    expect(hashPayload(bumped)).not.toBe(hashPayload(basePayload));
  });

  it('changes hash when presets change', () => {
    const modified = buildPayload(
      {
        presets: ['a', 'b', 'c'],
        agents: ['claude-code'],
        rules: { 'x/foo': { enabled: true, severity: 'warn' } },
        resolvedAt: '2026-04-05T00:00:00.000Z',
      },
      '1.4.0',
    );
    expect(hashPayload(modified)).not.toBe(hashPayload(basePayload));
  });

  it('changes hash when rule severity changes', () => {
    const modified = buildPayload(
      {
        presets: ['a', 'b'],
        agents: ['claude-code'],
        rules: { 'x/foo': { enabled: true, severity: 'block' } },
        resolvedAt: '2026-04-05T00:00:00.000Z',
      },
      '1.4.0',
    );
    expect(hashPayload(modified)).not.toBe(hashPayload(basePayload));
  });

  it('ignores language/framework for hashing (they do not affect the snapshot)', () => {
    const withLang = buildPayload(
      {
        presets: ['a', 'b'],
        agents: ['claude-code'],
        rules: { 'x/foo': { enabled: true, severity: 'warn' } },
        resolvedAt: '2026-04-05T00:00:00.000Z',
        language: 'typescript',
        framework: 'nextjs-15',
      },
      '1.4.0',
    );
    expect(hashPayload(withLang)).toBe(hashPayload(basePayload));
  });
});
