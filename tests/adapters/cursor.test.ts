import { describe, it, expect } from 'vitest';
import { cursorAdapter } from '../../src/adapters/cursor/adapter.js';
import type { ResolvedConfig } from '../../src/types.js';

// Register rules so adapter can find them
import '../../src/rules/index.js';

function makeConfig(): ResolvedConfig {
  return {
    presets: ['nextjs-15'],
    agents: ['cursor'],
    rules: new Map([
      ['security/branch-protection', { enabled: true, severity: 'block' as const, options: {} }],
      ['quality/import-aliases', { enabled: true, severity: 'block' as const, options: { aliases: ['@/'] } }],
      ['quality/no-use-client-in-pages', { enabled: true, severity: 'block' as const, options: {} }],
    ]),
  };
}

describe('Cursor adapter', () => {
  it('should generate .cursorrules file', async () => {
    const files = await cursorAdapter.generate(makeConfig(), '/project');
    const cursorRulesFile = files.find((f) => f.path === '.cursorrules');
    expect(cursorRulesFile).toBeDefined();
    expect(cursorRulesFile!.content).toContain('VibeCheck Rules');
    expect(cursorRulesFile!.content).toContain('advisory');
  });

  it('should generate per-rule .mdc files', async () => {
    const files = await cursorAdapter.generate(makeConfig(), '/project');
    const mdcFiles = files.filter((f) => f.path.startsWith('.cursor/rules/'));
    expect(mdcFiles.length).toBeGreaterThanOrEqual(3);
  });

  it('should include rule descriptions in .mdc files', async () => {
    const files = await cursorAdapter.generate(makeConfig(), '/project');
    const branchMdc = files.find((f) => f.path.includes('branch-protection'));
    expect(branchMdc).toBeDefined();
    expect(branchMdc!.content).toContain('Branch Protection');
  });

  it('should mark enforcement as advisory', () => {
    expect(cursorAdapter.enforcement).toBe('advisory');
  });

  it('should skip disabled rules', async () => {
    const config = makeConfig();
    config.rules.set('security/branch-protection', { enabled: false, severity: 'block', options: {} });
    const files = await cursorAdapter.generate(config, '/project');
    const branchMdc = files.find((f) => f.path.includes('branch-protection'));
    expect(branchMdc).toBeUndefined();
  });
});
