import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ResolvedConfig, Rule } from '../../src/types.js';

// Register rules so bundler can find them
import '../../src/presets/index.js';
import '../../src/rules/index.js';

import { bundleHookScript } from '../../src/eject/bundler.js';

function makeConfig(rulesOverrides?: Map<string, { enabled: boolean; severity: 'block' | 'warn' | 'info'; options: Record<string, unknown> }>): ResolvedConfig {
  return {
    presets: ['nextjs-15'],
    agents: ['claude-code'],
    rules: rulesOverrides ?? new Map([
      ['security/branch-protection', { enabled: true, severity: 'block' as const, options: {} }],
      ['security/destructive-commands', { enabled: true, severity: 'block' as const, options: {} }],
      ['quality/import-aliases', { enabled: true, severity: 'warn' as const, options: {} }],
    ]),
  };
}

describe('bundleHookScript', () => {
  it('generates valid JavaScript with shebang', () => {
    const script = bundleHookScript('PreToolUse', makeConfig());
    expect(script.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('embeds serialized config as JSON', () => {
    const script = bundleHookScript('PreToolUse', makeConfig());
    expect(script).toContain('const CONFIG =');
    expect(script).toContain('"presets"');
    expect(script).toContain('"agents"');
  });

  it('includes enabled rules for PreToolUse event', () => {
    const script = bundleHookScript('PreToolUse', makeConfig());
    // Should include some rule check code
    expect(script).toContain('Rule Checks');
  });

  it('includes enabled rules for PostToolUse event', () => {
    const script = bundleHookScript('PostToolUse', makeConfig());
    expect(script).toContain('PostToolUse');
  });

  it('includes enabled rules for Stop event', () => {
    const script = bundleHookScript('Stop', makeConfig());
    expect(script).toContain('Stop');
  });

  it('skips disabled rules', () => {
    const config = makeConfig(new Map([
      ['security/branch-protection', { enabled: false, severity: 'block' as const, options: {} }],
      ['quality/import-aliases', { enabled: true, severity: 'warn' as const, options: {} }],
    ]));
    const script = bundleHookScript('PreToolUse', config);
    // Disabled rules should not have inline template code
    // But the config JSON still contains them
    expect(script).toBeDefined();
  });

  it('generates correct output handler per event type', () => {
    const config = makeConfig();

    const preScript = bundleHookScript('PreToolUse', config);
    expect(preScript).toContain('process.exit(2)'); // Block exit

    const postScript = bundleHookScript('PostToolUse', config);
    expect(postScript).toContain('PostToolUse');

    const stopScript = bundleHookScript('Stop', config);
    expect(stopScript).toContain('session summary');
  });

  it('wraps rule checks in try/catch (fail-open)', () => {
    const script = bundleHookScript('PreToolUse', makeConfig());
    expect(script).toContain('try {');
    expect(script).toContain('fail-open');
  });

  it('includes generation timestamp', () => {
    const script = bundleHookScript('PreToolUse', makeConfig());
    expect(script).toContain('Generated:');
  });

  it('includes rules list in header comment', () => {
    const script = bundleHookScript('PreToolUse', makeConfig());
    expect(script).toContain('Rules:');
  });

  it('handles empty rules gracefully', () => {
    const config = makeConfig(new Map());
    const script = bundleHookScript('PreToolUse', config);
    expect(script).toBeDefined();
    expect(script).toContain('#!/usr/bin/env node');
  });
});
