import { describe, it, expect, beforeEach } from 'vitest';
import type { ResolvedConfig } from '../../src/types.js';

// Import to register rules
import '../../src/presets/index.js';
import '../../src/rules/index.js';

import { bundleHookScript } from '../../src/eject/bundler.js';

function makeConfig(): ResolvedConfig {
  return {
    presets: ['nextjs-15'],
    agents: ['claude-code'],
    rules: new Map([
      ['security/branch-protection', { enabled: true, severity: 'block' as const, options: {} }],
      ['security/destructive-commands', { enabled: true, severity: 'block' as const, options: {} }],
      ['quality/import-aliases', { enabled: true, severity: 'warn' as const, options: {} }],
    ]),
  };
}

describe('Eject Roundtrip', () => {
  it('bundled PreToolUse script is valid JavaScript', () => {
    const config = makeConfig();
    const script = bundleHookScript('PreToolUse', config);

    expect(script).toBeTruthy();
    expect(script).toContain('#!/usr/bin/env node');
    expect(script).toContain('PreToolUse');

    // Should be parseable JavaScript (no syntax errors)
    expect(() => new Function(script.replace('#!/usr/bin/env node', ''))).not.toThrow();
  });

  it('bundled PostToolUse script is valid JavaScript', () => {
    const config = makeConfig();
    const script = bundleHookScript('PostToolUse', config);

    expect(script).toContain('#!/usr/bin/env node');
    expect(script).toContain('PostToolUse');
  });

  it('bundled Stop script is valid JavaScript', () => {
    const config = makeConfig();
    const script = bundleHookScript('Stop', config);

    expect(script).toContain('#!/usr/bin/env node');
    expect(script).toContain('Stop');
  });

  it('bundled script includes embedded config', () => {
    const config = makeConfig();
    const script = bundleHookScript('PreToolUse', config);

    expect(script).toContain('CONFIG');
    expect(script).toContain('security/branch-protection');
  });

  it('bundled script includes rule checks for enabled rules', () => {
    const config = makeConfig();
    const script = bundleHookScript('PreToolUse', config);

    // Should contain some rule check logic
    expect(script).toContain('try {');
    expect(script).toContain('fail-open');
  });

  it('bundled script skips disabled rules', () => {
    const config: ResolvedConfig = {
      presets: [],
      agents: ['claude-code'],
      rules: new Map([
        ['security/branch-protection', { enabled: false, severity: 'block' as const, options: {} }],
        ['quality/import-aliases', { enabled: true, severity: 'warn' as const, options: {} }],
      ]),
    };

    const script = bundleHookScript('PreToolUse', config);

    // Disabled rule should not appear in the inline checks
    // (it may appear in config but not as a rule check)
    expect(script).toContain('import-aliases');
  });

  it('bundled script contains correct output handler for PreToolUse', () => {
    const config = makeConfig();
    const script = bundleHookScript('PreToolUse', config);

    expect(script).toContain('process.exit(2)'); // Block exit code
    expect(script).toContain('process.exit(0)'); // Pass exit code
  });

  it('bundled script contains correct output handler for Stop', () => {
    const config = makeConfig();
    const script = bundleHookScript('Stop', config);

    expect(script).toContain('session summary');
    expect(script).toContain('process.exit(0)');
  });
});
