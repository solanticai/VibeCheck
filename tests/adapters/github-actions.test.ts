import { describe, it, expect } from 'vitest';

import '../../src/presets/index.js';
import '../../src/rules/index.js';

import { githubActionsAdapter } from '../../src/adapters/github-actions/adapter.js';
import type { ResolvedConfig } from '../../src/types.js';

function makeConfig(): ResolvedConfig {
  return {
    presets: ['nextjs-15'],
    agents: ['claude-code'],
    rules: new Map([
      ['security/branch-protection', { enabled: true, severity: 'block' as const, options: {} }],
    ]),
  };
}

describe('GitHub Actions Adapter', () => {
  it('generates workflow file', async () => {
    const files = await githubActionsAdapter.generate(makeConfig(), '/tmp/test-project');
    expect(files.length).toBeGreaterThan(0);

    const workflowFile = files.find((f) => f.path.includes('.github/workflows/'));
    expect(workflowFile).toBeDefined();
  });

  it('generates valid YAML content', async () => {
    const files = await githubActionsAdapter.generate(makeConfig(), '/tmp/test-project');
    const workflowFile = files.find((f) => f.path.includes('.github/workflows/'));
    expect(workflowFile).toBeDefined();

    // Should have YAML structure markers
    expect(workflowFile!.content).toContain('name:');
    expect(workflowFile!.content).toContain('on:');
  });

  it('includes lint step', async () => {
    const files = await githubActionsAdapter.generate(makeConfig(), '/tmp/test-project');
    const workflowFile = files.find((f) => f.path.includes('.github/workflows/'));
    expect(workflowFile).toBeDefined();

    // Should reference vguard lint
    expect(workflowFile!.content).toContain('vguard');
  });

  it('has runtime enforcement', () => {
    expect(githubActionsAdapter.enforcement).toBe('runtime');
  });
});
