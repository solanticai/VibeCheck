import { describe, it, expect } from 'vitest';

import '../../src/presets/index.js';
import '../../src/rules/index.js';

import { openCodeAdapter } from '../../src/adapters/opencode/adapter.js';
import type { ResolvedConfig } from '../../src/types.js';

function makeConfig(): ResolvedConfig {
  return {
    presets: ['nextjs-15'],
    agents: ['opencode'],
    rules: new Map([
      ['security/branch-protection', { enabled: true, severity: 'block' as const, options: {} }],
      ['quality/import-aliases', { enabled: true, severity: 'warn' as const, options: {} }],
    ]),
  };
}

describe('OpenCode Adapter', () => {
  it('generates configuration files', async () => {
    const files = await openCodeAdapter.generate(makeConfig(), '/tmp/test-project');
    expect(files.length).toBeGreaterThan(0);
  });

  it('includes rule descriptions in generated content', async () => {
    const files = await openCodeAdapter.generate(makeConfig(), '/tmp/test-project');
    const hasRuleInfo = files.some(
      (f) => f.content.includes('branch-protection') || f.content.includes('VGuard'),
    );
    expect(hasRuleInfo).toBe(true);
  });

  it('has advisory enforcement', () => {
    expect(openCodeAdapter.enforcement).toBe('advisory');
  });
});
