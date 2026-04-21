import type { Rule, RuleResult, VGuardPlugin, Preset } from '../../../src/types.js';
import { readUsage } from '../../../src/engine/cost-tracker.js';

// Per-tool cost budget rule.
// Uses UsageRecord.metadata.tool if present (written by callers that
// tag per-tool usage). Falls back to summing *all* session usage when
// the tool tag is not available.
const perToolBudget: Rule = {
  id: 'cost-guardrails/per-tool-budget',
  name: 'Per-tool Cost Budget',
  description:
    'Blocks a specific tool (e.g. WebFetch, Bash) when its per-tool token budget is exhausted.',
  severity: 'block',
  events: ['PreToolUse'],
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'cost-guardrails/per-tool-budget';

    try {
      const repoRoot = context.gitContext.repoRoot;
      if (!repoRoot) return { status: 'pass', ruleId };

      const cfg = context.projectConfig.rules.get(ruleId);
      const budgets =
        (cfg?.options?.tokensPerToolPerSession as Record<string, number> | undefined) ?? {};
      const tool = context.tool;
      const limit = budgets[tool];
      if (!limit) return { status: 'pass', ruleId };

      const records = readUsage(repoRoot, { sessionId: context.sessionId });
      // Usage records don't include tool tagging by default. When callers
      // add it via metadata, we honour it. Otherwise we use session total.
      const toolTokens = records
        .filter((r) => {
          const meta = r as unknown as { tool?: string };
          return !meta.tool || meta.tool === tool;
        })
        .reduce((acc, r) => acc + r.inputTokens + r.outputTokens, 0);

      if (toolTokens >= limit) {
        return {
          status: 'block',
          ruleId,
          message: `Per-tool token budget exhausted for ${tool}: ${toolTokens.toLocaleString()} / ${limit.toLocaleString()}.`,
          fix: 'Increase cost-guardrails/per-tool-budget.options.tokensPerToolPerSession[<tool>] in vguard.config.ts, or end the session.',
          metadata: { tool, toolTokens, limit },
        };
      }

      return { status: 'pass', ruleId };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};

const costGuardrailsPreset: Preset = {
  id: 'cost-guardrails',
  name: 'Cost Guardrails',
  description: 'Turns on core cost-budget + per-tool budgets with conservative defaults.',
  version: '0.1.0',
  rules: {
    'workflow/cost-budget': {
      severity: 'block',
      tokensPerSession: 200_000,
      usdPerDay: 10,
    },
    'cost-guardrails/per-tool-budget': {
      severity: 'block',
      tokensPerToolPerSession: { WebFetch: 20_000, Bash: 5_000 },
    },
  },
};

const plugin: VGuardPlugin = {
  name: '@anthril/vguard-cost-guardrails',
  version: '0.1.0',
  rules: [perToolBudget],
  presets: [costGuardrailsPreset],
};

export default plugin;
export { plugin, perToolBudget, costGuardrailsPreset };
