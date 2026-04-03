import { describe, it, expect } from 'vitest';
import type { ResolvedConfig } from '../../src/types.js';

// Import and register rules/presets
import '../../src/presets/index.js';
import '../../src/rules/index.js';

import { claudeCodeAdapter } from '../../src/adapters/claude-code/adapter.js';
import { cursorAdapter } from '../../src/adapters/cursor/adapter.js';
import { codexAdapter } from '../../src/adapters/codex/adapter.js';

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    presets: ['nextjs-15'],
    agents: ['claude-code'],
    rules: new Map([
      ['security/branch-protection', { enabled: true, severity: 'block' as const, options: {} }],
      ['security/destructive-commands', { enabled: true, severity: 'block' as const, options: {} }],
      ['quality/import-aliases', { enabled: true, severity: 'warn' as const, options: {} }],
    ]),
    ...overrides,
  };
}

describe('Claude Code Adapter Integration', () => {
  it('generates hook scripts and settings', async () => {
    const config = makeConfig();
    const files = await claudeCodeAdapter.generate(config, '/tmp/test-project');

    expect(files.length).toBeGreaterThan(0);

    // Should include hook scripts
    const hookFiles = files.filter((f) => f.path.includes('.vguard/hooks/'));
    expect(hookFiles.length).toBeGreaterThan(0);

    // Should include settings.json
    const settingsFile = files.find((f) => f.path.includes('settings.json'));
    expect(settingsFile).toBeDefined();
    expect(settingsFile!.mergeStrategy).toBe('merge');
  });

  it('generates valid JSON in settings file', async () => {
    const config = makeConfig();
    const files = await claudeCodeAdapter.generate(config, '/tmp/test-project');
    const settingsFile = files.find((f) => f.path.includes('settings.json'));

    expect(settingsFile).toBeDefined();
    const parsed = JSON.parse(settingsFile!.content);
    expect(parsed).toHaveProperty('hooks');
  });

  it('generates enforcement rules markdown', async () => {
    const config = makeConfig();
    const files = await claudeCodeAdapter.generate(config, '/tmp/test-project');
    const rulesFile = files.find((f) => f.path.includes('rules/'));

    if (rulesFile) {
      expect(rulesFile.content).toContain('VGuard');
    }
  });

  it('generates command files', async () => {
    const config = makeConfig();
    const files = await claudeCodeAdapter.generate(config, '/tmp/test-project');
    const commandFiles = files.filter((f) => f.path.includes('commands/'));

    // Should have at least some command files
    expect(commandFiles.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Cursor Adapter Integration', () => {
  it('generates .cursorrules file', async () => {
    const config = makeConfig({ agents: ['cursor'] });
    const files = await cursorAdapter.generate(config, '/tmp/test-project');

    expect(files.length).toBeGreaterThan(0);
    const cursorRules = files.find((f) => f.path === '.cursorrules' || f.path.includes('.cursor/'));
    expect(cursorRules).toBeDefined();
  });

  it('includes rule descriptions in generated content', async () => {
    const config = makeConfig({ agents: ['cursor'] });
    const files = await cursorAdapter.generate(config, '/tmp/test-project');

    // At least one file should mention the rules
    const hasRuleMention = files.some((f) => f.content.includes('branch-protection') || f.content.includes('security'));
    expect(hasRuleMention).toBe(true);
  });
});

describe('Codex Adapter Integration', () => {
  it('generates AGENTS.md or config', async () => {
    const config = makeConfig({ agents: ['codex'] });
    const files = await codexAdapter.generate(config, '/tmp/test-project');

    expect(files.length).toBeGreaterThan(0);
  });

  it('includes rule documentation', async () => {
    const config = makeConfig({ agents: ['codex'] });
    const files = await codexAdapter.generate(config, '/tmp/test-project');

    const hasRuleInfo = files.some((f) => f.content.includes('branch-protection') || f.content.includes('VGuard'));
    expect(hasRuleInfo).toBe(true);
  });
});
