import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import plugin, { perToolBudget, costGuardrailsPreset } from '../src/index.js';
import { recordUsage } from '../../../src/engine/cost-tracker.js';
import type { HookContext, ResolvedConfig, ResolvedRuleConfig } from '../../../src/types.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'vg-cost-plugin-'));
  return () => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  };
});

function makeContext(sessionId: string, tool: string, ruleConfig: ResolvedRuleConfig): HookContext {
  const rules = new Map<string, ResolvedRuleConfig>([
    ['cost-guardrails/per-tool-budget', ruleConfig],
  ]);
  const projectConfig: ResolvedConfig = {
    presets: [],
    agents: ['claude-code'],
    rules,
  };
  return {
    event: 'PreToolUse',
    tool,
    toolInput: {},
    projectConfig,
    sessionId,
    gitContext: {
      branch: 'main',
      isDirty: false,
      repoRoot: tmp,
      unpushedCount: 0,
      hasRemote: false,
    },
  };
}

describe('@anthril/vguard-cost-guardrails', () => {
  it('exposes a VGuardPlugin with rules and a preset', () => {
    expect(plugin.name).toBe('@anthril/vguard-cost-guardrails');
    expect(plugin.rules?.length).toBe(1);
    expect(plugin.presets).toContainEqual(costGuardrailsPreset);
  });
});

describe('cost-guardrails/per-tool-budget', () => {
  it('passes when no per-tool budget is configured', async () => {
    const r = await perToolBudget.check(
      makeContext('s1', 'WebFetch', { enabled: true, severity: 'block', options: {} }),
    );
    expect(r.status).toBe('pass');
  });

  it('blocks when the per-tool token budget is exhausted', async () => {
    recordUsage(tmp, {
      inputTokens: 6_000,
      outputTokens: 6_000,
      sessionId: 's1',
    });
    const r = await perToolBudget.check(
      makeContext('s1', 'WebFetch', {
        enabled: true,
        severity: 'block',
        options: { tokensPerToolPerSession: { WebFetch: 10_000 } },
      }),
    );
    expect(r.status).toBe('block');
    expect(r.message).toContain('WebFetch');
  });

  it('passes when the tool has no configured budget entry', async () => {
    recordUsage(tmp, { inputTokens: 1_000, outputTokens: 1_000, sessionId: 's1' });
    const r = await perToolBudget.check(
      makeContext('s1', 'Read', {
        enabled: true,
        severity: 'block',
        options: { tokensPerToolPerSession: { WebFetch: 10_000 } },
      }),
    );
    expect(r.status).toBe('pass');
  });
});
