import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { costBudget } from '../../../src/rules/workflow/cost-budget.js';
import { recordUsage } from '../../../src/engine/cost-tracker.js';
import type { HookContext, ResolvedConfig, ResolvedRuleConfig } from '../../../src/types.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'vg-budget-'));
  return () => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  };
});

function makeContext(sessionId: string, ruleConfig: ResolvedRuleConfig): HookContext {
  const rules = new Map<string, ResolvedRuleConfig>([['workflow/cost-budget', ruleConfig]]);
  const projectConfig: ResolvedConfig = {
    presets: [],
    agents: ['claude-code'],
    rules,
  };
  return {
    event: 'PreToolUse',
    tool: 'Bash',
    toolInput: { command: 'echo hi' },
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

describe('workflow/cost-budget', () => {
  it('passes when no budget is configured', async () => {
    const r = await costBudget.check(
      makeContext('s1', { enabled: true, severity: 'block', options: {} }),
    );
    expect(r.status).toBe('pass');
  });

  it('passes when under the session token budget', async () => {
    recordUsage(tmp, { inputTokens: 500, outputTokens: 500, sessionId: 's1' });
    const r = await costBudget.check(
      makeContext('s1', {
        enabled: true,
        severity: 'block',
        options: { tokensPerSession: 10_000 },
      }),
    );
    expect(r.status).toBe('pass');
  });

  it('blocks when the session token budget is exhausted', async () => {
    recordUsage(tmp, { inputTokens: 6_000, outputTokens: 6_000, sessionId: 's1' });
    const r = await costBudget.check(
      makeContext('s1', {
        enabled: true,
        severity: 'block',
        options: { tokensPerSession: 10_000 },
      }),
    );
    expect(r.status).toBe('block');
    expect(r.message).toContain('Session token budget exhausted');
  });

  it('blocks when the session USD budget is exhausted', async () => {
    recordUsage(tmp, {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      sessionId: 's1',
      model: 'm',
      modelPricing: { m: { inputPer1M: 3, outputPer1M: 15 } },
    });
    const r = await costBudget.check(
      makeContext('s1', {
        enabled: true,
        severity: 'block',
        options: { usdPerSession: 2 },
      }),
    );
    expect(r.status).toBe('block');
    expect(r.message).toContain('Session USD budget exhausted');
  });
});
