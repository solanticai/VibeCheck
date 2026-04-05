import { describe, it, expect } from 'vitest';
import { claudeCodeAdapter } from '../../src/adapters/claude-code/adapter.js';
import { generateCommands } from '../../src/adapters/claude-code/command-generator.js';
import { generateEnforcementRules } from '../../src/adapters/claude-code/rules-generator.js';
import type { ResolvedConfig } from '../../src/types.js';

// Register rules so adapter can find them
import '../../src/rules/index.js';
import '../../src/presets/index.js';

function makeConfig(): ResolvedConfig {
  return {
    presets: ['nextjs-15'],
    agents: ['claude-code'],
    rules: new Map([
      ['security/branch-protection', { enabled: true, severity: 'block' as const, options: {} }],
      ['security/destructive-commands', { enabled: true, severity: 'block' as const, options: {} }],
      ['quality/import-aliases', { enabled: true, severity: 'warn' as const, options: {} }],
      ['workflow/commit-conventions', { enabled: true, severity: 'warn' as const, options: {} }],
    ]),
  };
}

describe('Claude Code adapter', () => {
  it('should mark enforcement as runtime', () => {
    expect(claudeCodeAdapter.enforcement).toBe('runtime');
  });

  it('should generate hook scripts for active events', async () => {
    const files = await claudeCodeAdapter.generate(makeConfig(), '/project');
    const hookFiles = files.filter((f) => f.path.startsWith('.vguard/hooks/'));
    expect(hookFiles.length).toBeGreaterThan(0);
    for (const hook of hookFiles) {
      expect(hook.content).toContain('executeHook');
      expect(hook.mergeStrategy).toBe('overwrite');
    }
  });

  it('should generate settings.json with merge strategy', async () => {
    const files = await claudeCodeAdapter.generate(makeConfig(), '/project');
    const settings = files.find((f) => f.path === '.claude/settings.json');
    expect(settings).toBeDefined();
    expect(settings!.mergeStrategy).toBe('merge');
    const parsed = JSON.parse(settings!.content);
    expect(parsed.hooks).toBeDefined();
  });

  it('should generate command files with create-only strategy', async () => {
    const files = await claudeCodeAdapter.generate(makeConfig(), '/project');
    const commandFiles = files.filter((f) => f.path.startsWith('.claude/commands/'));
    expect(commandFiles.length).toBe(9);
    for (const cmd of commandFiles) {
      expect(cmd.mergeStrategy).toBe('create-only');
      expect(cmd.path).toMatch(/\.claude\/commands\/vguard-\w+\.md$/);
    }
  });

  it('should generate enforcement rules with overwrite strategy', async () => {
    const files = await claudeCodeAdapter.generate(makeConfig(), '/project');
    const rulesFile = files.find((f) => f.path === '.claude/rules/vguard-enforcement.md');
    expect(rulesFile).toBeDefined();
    expect(rulesFile!.mergeStrategy).toBe('overwrite');
    expect(rulesFile!.content).toContain('VGuard Enforcement Rules');
  });

  it('should include all expected command names', async () => {
    const files = await claudeCodeAdapter.generate(makeConfig(), '/project');
    const commandNames = files
      .filter((f) => f.path.startsWith('.claude/commands/'))
      .map((f) => f.path.replace('.claude/commands/', '').replace('.md', ''));

    expect(commandNames).toContain('vguard-lint');
    expect(commandNames).toContain('vguard-doctor');
    expect(commandNames).toContain('vguard-report');
    expect(commandNames).toContain('vguard-add');
    expect(commandNames).toContain('vguard-remove');
    expect(commandNames).toContain('vguard-fix');
    expect(commandNames).toContain('vguard-learn');
    expect(commandNames).toContain('vguard-status');
    expect(commandNames).toContain('vguard-upgrade');
  });

  it('should always generate SessionStart and SessionEnd hook scripts', async () => {
    const files = await claudeCodeAdapter.generate(makeConfig(), '/project');
    const hookPaths = files.filter((f) => f.path.startsWith('.vguard/hooks/')).map((f) => f.path);

    expect(hookPaths).toContain('.vguard/hooks/vguard-sessionstart.js');
    expect(hookPaths).toContain('.vguard/hooks/vguard-sessionend.js');
  });

  it('should register SessionStart and SessionEnd in settings.json without a matcher', async () => {
    const files = await claudeCodeAdapter.generate(makeConfig(), '/project');
    const settings = files.find((f) => f.path === '.claude/settings.json');
    expect(settings).toBeDefined();

    const parsed = JSON.parse(settings!.content) as {
      hooks: Record<string, Array<Record<string, unknown>>>;
    };

    expect(parsed.hooks.SessionStart).toBeDefined();
    expect(parsed.hooks.SessionEnd).toBeDefined();

    // Lifecycle hooks are matcher-less
    expect(parsed.hooks.SessionStart[0].matcher).toBeUndefined();
    expect(parsed.hooks.SessionEnd[0].matcher).toBeUndefined();
  });

  it('should register SessionStart/SessionEnd even when no rules reference those events', async () => {
    // Minimal config with rules that only target PreToolUse/PostToolUse/Stop
    const config: ResolvedConfig = {
      presets: [],
      agents: ['claude-code'],
      rules: new Map(),
    };

    const files = await claudeCodeAdapter.generate(config, '/project');
    const hookPaths = files.filter((f) => f.path.startsWith('.vguard/hooks/')).map((f) => f.path);

    expect(hookPaths).toContain('.vguard/hooks/vguard-sessionstart.js');
    expect(hookPaths).toContain('.vguard/hooks/vguard-sessionend.js');
  });
});

describe('Command generator', () => {
  it('should return 9 command files', () => {
    const files = generateCommands(makeConfig());
    expect(files.length).toBe(9);
  });

  it('should use create-only strategy for all commands', () => {
    const files = generateCommands(makeConfig());
    for (const file of files) {
      expect(file.mergeStrategy).toBe('create-only');
    }
  });

  it('should include npx vguard commands in templates', () => {
    const files = generateCommands(makeConfig());
    const lint = files.find((f) => f.path.includes('vguard-lint'));
    expect(lint).toBeDefined();
    expect(lint!.content).toContain('npx vguard lint');
  });

  it('should populate vguard-add with available presets and rules', () => {
    const files = generateCommands(makeConfig());
    const add = files.find((f) => f.path.includes('vguard-add'));
    expect(add).toBeDefined();
    expect(add!.content).toContain('Available Presets');
    expect(add!.content).toContain('Available Rules');
    // Should list some known presets
    expect(add!.content).toContain('nextjs-15');
    // Should list some known rules
    expect(add!.content).toContain('branch-protection');
  });
});

describe('Rules generator', () => {
  it('should generate enforcement rules markdown', () => {
    const file = generateEnforcementRules(makeConfig());
    expect(file.path).toBe('.claude/rules/vguard-enforcement.md');
    expect(file.mergeStrategy).toBe('overwrite');
  });

  it('should include active rule count', () => {
    const file = generateEnforcementRules(makeConfig());
    expect(file.content).toContain('4 rules');
  });

  it('should group rules by category', () => {
    const file = generateEnforcementRules(makeConfig());
    expect(file.content).toContain('Security');
    expect(file.content).toContain('Quality');
    expect(file.content).toContain('Workflow');
  });

  it('should include rule severity levels', () => {
    const file = generateEnforcementRules(makeConfig());
    expect(file.content).toContain('[block]');
    expect(file.content).toContain('[warn]');
  });

  it('should include quick reference commands', () => {
    const file = generateEnforcementRules(makeConfig());
    expect(file.content).toContain('npx vguard lint');
    expect(file.content).toContain('npx vguard doctor');
    expect(file.content).toContain('npx vguard fix');
  });

  it('should skip disabled rules', () => {
    const config = makeConfig();
    config.rules.set('security/branch-protection', {
      enabled: false,
      severity: 'block',
      options: {},
    });
    const file = generateEnforcementRules(config);
    expect(file.content).not.toContain('Branch Protection');
  });

  it('should include generation header', () => {
    const file = generateEnforcementRules(makeConfig());
    expect(file.content).toContain('Generated by VGuard');
    expect(file.content).toContain('npx vguard generate');
  });
});
