import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { currentSessionSpend, rollingWindowSpend } from '../../engine/cost-tracker.js';

const configSchema = z.object({
  tokensPerSession: z.number().positive().optional(),
  usdPerSession: z.number().positive().optional(),
  usdPerDay: z.number().positive().optional(),
});

/**
 * workflow/cost-budget
 *
 * Blocks further PreToolUse work when configured session- or day-level
 * token/cost budgets have been exhausted. Reads from
 * .vguard/data/cost-usage.jsonl (populated by recordUsage in the engine's
 * cost-tracker). Addresses OWASP LLM10 (Unbounded Consumption) and
 * Agentic ASI08 (Cascading Failures).
 */
export const costBudget: Rule = {
  id: 'workflow/cost-budget',
  name: 'Cost Budget',
  description: 'Blocks the session when configured token/USD budgets are exhausted.',
  severity: 'block',
  events: ['PreToolUse'],
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'workflow/cost-budget';

    try {
      const repoRoot = context.gitContext.repoRoot;
      if (!repoRoot) return { status: 'pass', ruleId };

      const ruleConfig = context.projectConfig.rules.get(ruleId);
      const tokensPerSession = ruleConfig?.options?.tokensPerSession as number | undefined;
      const usdPerSession = ruleConfig?.options?.usdPerSession as number | undefined;
      const usdPerDay = ruleConfig?.options?.usdPerDay as number | undefined;

      if (!tokensPerSession && !usdPerSession && !usdPerDay) {
        return { status: 'pass', ruleId };
      }

      const sessionId = context.sessionId;
      const session = currentSessionSpend(repoRoot, sessionId);
      const day = rollingWindowSpend(repoRoot, 24 * 60 * 60 * 1000);

      const sessionTokens = session.totalInputTokens + session.totalOutputTokens;

      if (tokensPerSession && sessionTokens >= tokensPerSession) {
        return {
          status: 'block',
          ruleId,
          message: `Session token budget exhausted: ${sessionTokens.toLocaleString()} / ${tokensPerSession.toLocaleString()}.`,
          fix: 'Increase workflow/cost-budget.options.tokensPerSession in vguard.config.ts, or end the session and start a new one.',
          metadata: { sessionTokens, tokensPerSession },
        };
      }

      if (usdPerSession && session.totalUsd >= usdPerSession) {
        return {
          status: 'block',
          ruleId,
          message: `Session USD budget exhausted: $${session.totalUsd.toFixed(2)} / $${usdPerSession.toFixed(2)}.`,
          fix: 'Increase workflow/cost-budget.options.usdPerSession in vguard.config.ts, or end the session.',
          metadata: { sessionUsd: session.totalUsd, usdPerSession },
        };
      }

      if (usdPerDay && day.totalUsd >= usdPerDay) {
        return {
          status: 'block',
          ruleId,
          message: `24h USD budget exhausted: $${day.totalUsd.toFixed(2)} / $${usdPerDay.toFixed(2)}.`,
          fix: 'Increase workflow/cost-budget.options.usdPerDay in vguard.config.ts, or wait for the rolling window to reset.',
          metadata: { dayUsd: day.totalUsd, usdPerDay },
        };
      }

      return { status: 'pass', ruleId };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};
