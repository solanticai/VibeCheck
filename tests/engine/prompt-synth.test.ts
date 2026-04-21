import { describe, it, expect } from 'vitest';
import { synthesisePolicyPrompt } from '../../src/engine/prompt-synth.js';
import type { ResolvedConfig, ResolvedRuleConfig } from '../../src/types.js';
// Register built-in rules so getAllRules() returns them.
import '../../src/rules/index.js';

function buildConfig(rules: Array<[string, ResolvedRuleConfig]>): ResolvedConfig {
  return {
    presets: [],
    agents: ['claude-code'],
    rules: new Map(rules),
  };
}

describe('synthesisePolicyPrompt', () => {
  it('emits a VGuard Policy header and a boundary marker', () => {
    const cfg = buildConfig([
      ['security/sql-injection', { enabled: true, severity: 'block', options: {} }],
    ]);
    const out = synthesisePolicyPrompt(cfg, { agent: 'claude-code' });
    expect(out).toContain('# VGuard Policy');
    expect(out).toContain('VGUARD-POLICY-START');
    expect(out).toContain('VGUARD-POLICY-END');
  });

  it('groups rules into severity sections', () => {
    const cfg = buildConfig([
      ['security/sql-injection', { enabled: true, severity: 'block', options: {} }],
      ['security/weak-crypto', { enabled: true, severity: 'warn', options: {} }],
    ]);
    const out = synthesisePolicyPrompt(cfg, { agent: 'claude-code' });
    expect(out).toContain('Must not do (blocking)');
    expect(out).toContain('Avoid when possible (warning)');
    expect(out).toContain('security/sql-injection');
    expect(out).toContain('security/weak-crypto');
  });

  it('omits severity sections with zero matching rules', () => {
    const cfg = buildConfig([
      ['security/sql-injection', { enabled: true, severity: 'block', options: {} }],
    ]);
    const out = synthesisePolicyPrompt(cfg, { agent: 'claude-code' });
    expect(out).toContain('Must not do (blocking)');
    expect(out).not.toContain('Avoid when possible (warning)');
    expect(out).not.toContain('Style hints (informational)');
  });

  it('skips disabled rules', () => {
    const cfg = buildConfig([
      ['security/sql-injection', { enabled: false, severity: 'block', options: {} }],
      ['security/weak-crypto', { enabled: true, severity: 'warn', options: {} }],
    ]);
    const out = synthesisePolicyPrompt(cfg, { agent: 'claude-code' });
    expect(out).not.toContain('sql-injection');
    expect(out).toContain('security/weak-crypto');
  });

  it('skips rules that are not registered in the registry', () => {
    const cfg = buildConfig([
      ['nonexistent/fake-rule', { enabled: true, severity: 'block', options: {} }],
    ]);
    const out = synthesisePolicyPrompt(cfg, { agent: 'claude-code' });
    expect(out).not.toContain('nonexistent/fake-rule');
    expect(out).toContain('**0 rules**');
  });

  it('is deterministic for the same inputs', () => {
    const cfg = buildConfig([
      ['security/sql-injection', { enabled: true, severity: 'block', options: {} }],
      ['security/weak-crypto', { enabled: true, severity: 'warn', options: {} }],
    ]);
    const a = synthesisePolicyPrompt(cfg, { agent: 'claude-code' });
    const b = synthesisePolicyPrompt(cfg, { agent: 'claude-code' });
    expect(a).toBe(b);
  });

  it('honors includeHeader:false and includeFooter:false', () => {
    const cfg = buildConfig([
      ['security/sql-injection', { enabled: true, severity: 'block', options: {} }],
    ]);
    const out = synthesisePolicyPrompt(cfg, {
      agent: 'claude-code',
      includeHeader: false,
      includeFooter: false,
    });
    expect(out).not.toContain('# VGuard Policy');
    expect(out).not.toContain('VGUARD-POLICY-START');
    expect(out).not.toContain('Quick reference');
    // But severity section still present
    expect(out).toContain('Must not do (blocking)');
  });
});
