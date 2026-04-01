import { describe, it, expect } from 'vitest';
import { codexAdapter } from '../../src/adapters/codex/adapter.js';
import { openCodeAdapter } from '../../src/adapters/opencode/adapter.js';
import type { ResolvedConfig } from '../../src/types.js';

import '../../src/rules/index.js';

function makeConfig(): ResolvedConfig {
  return {
    presets: [],
    agents: ['codex'],
    rules: new Map([
      ['security/branch-protection', { enabled: true, severity: 'block' as const, options: {} }],
      ['security/destructive-commands', { enabled: true, severity: 'block' as const, options: {} }],
      ['quality/import-aliases', { enabled: true, severity: 'warn' as const, options: {} }],
    ]),
  };
}

describe('Codex adapter', () => {
  it('should generate AGENTS.md', async () => {
    const files = await codexAdapter.generate(makeConfig(), '/p');
    const agentsMd = files.find((f) => f.path === 'AGENTS.md');
    expect(agentsMd).toBeDefined();
    expect(agentsMd!.content).toContain('Project Coding Guidelines');
    expect(agentsMd!.content).toContain('advisory');
  });

  it('should group rules by category', async () => {
    const files = await codexAdapter.generate(makeConfig(), '/p');
    const content = files[0].content;
    expect(content).toContain('Security Rules');
    expect(content).toContain('Quality Rules');
  });

  it('should mark enforcement as advisory', () => {
    expect(codexAdapter.enforcement).toBe('advisory');
  });

  it('should skip disabled rules', async () => {
    const config = makeConfig();
    config.rules.set('security/branch-protection', {
      enabled: false,
      severity: 'block',
      options: {},
    });
    const files = await codexAdapter.generate(config, '/p');
    expect(files[0].content).not.toContain('Branch Protection');
  });
});

describe('OpenCode adapter', () => {
  it('should generate instructions.md', async () => {
    const files = await openCodeAdapter.generate(makeConfig(), '/p');
    const instructions = files.find((f) => f.path === '.opencode/instructions.md');
    expect(instructions).toBeDefined();
    expect(instructions!.content).toContain('VibeCheck Rules');
    expect(instructions!.content).toContain('advisory');
  });

  it('should mark enforcement as advisory', () => {
    expect(openCodeAdapter.enforcement).toBe('advisory');
  });
});
