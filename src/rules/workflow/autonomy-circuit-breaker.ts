import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { readRuleHits } from '../../engine/tracker.js';

const configSchema = z.object({
  maxWrites: z.number().positive().optional(),
  maxBashExecs: z.number().positive().optional(),
  maxElapsedMinutes: z.number().positive().optional(),
});

const DEFAULTS = {
  maxWrites: 30,
  maxBashExecs: 20,
  maxElapsedMinutes: 30,
};

/**
 * workflow/autonomy-circuit-breaker
 *
 * Halts a session when it crosses autonomy thresholds without a human
 * checkpoint. Reads `.vguard/data/rule-hits.jsonl` to count writes and
 * bash executions in the current session, and checks wall-clock elapsed
 * time since session start. Addresses OWASP Agentic ASI08 (Cascading
 * Failures) and LLM10 (Unbounded Consumption).
 */
export const autonomyCircuitBreaker: Rule = {
  id: 'workflow/autonomy-circuit-breaker',
  name: 'Autonomy Circuit Breaker',
  description: 'Warns then blocks when a session exceeds autonomy thresholds without human input.',
  severity: 'warn',
  events: ['PreToolUse', 'Stop'],
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'workflow/autonomy-circuit-breaker';

    try {
      const repoRoot = context.gitContext.repoRoot;
      if (!repoRoot) return { status: 'pass', ruleId };

      const cfg = context.projectConfig.rules.get(ruleId);
      const maxWrites = (cfg?.options?.maxWrites as number) ?? DEFAULTS.maxWrites;
      const maxBash = (cfg?.options?.maxBashExecs as number) ?? DEFAULTS.maxBashExecs;
      const maxMin = (cfg?.options?.maxElapsedMinutes as number) ?? DEFAULTS.maxElapsedMinutes;

      const hits = readRuleHits(repoRoot);
      const sessionHits = context.sessionId
        ? hits.filter((h) => h.sessionId === context.sessionId)
        : hits.slice(-200); // fallback: recent activity

      const writes = sessionHits.filter(
        (h) => h.tool === 'Write' || h.tool === 'Edit' || h.tool === 'MultiEdit',
      ).length;
      const bash = sessionHits.filter((h) => h.tool === 'Bash').length;

      const oldest = sessionHits[0]?.timestamp;
      const elapsedMin = oldest ? (Date.now() - new Date(oldest).getTime()) / 60_000 : 0;

      const exceeded: string[] = [];
      if (writes >= maxWrites) exceeded.push(`writes=${writes}/${maxWrites}`);
      if (bash >= maxBash) exceeded.push(`bash=${bash}/${maxBash}`);
      if (elapsedMin >= maxMin) exceeded.push(`elapsed=${elapsedMin.toFixed(1)}min/${maxMin}min`);

      if (exceeded.length === 0) return { status: 'pass', ruleId };

      // Escalate to block at 1.5× thresholds
      const hardLimit =
        writes >= maxWrites * 1.5 || bash >= maxBash * 1.5 || elapsedMin >= maxMin * 1.5;

      return {
        status: hardLimit ? 'block' : 'warn',
        ruleId,
        message: `Autonomy threshold exceeded: ${exceeded.join(', ')}. Pause and request human input.`,
        fix: 'Stop autonomous execution and surface progress to the user. If the work is genuinely long-running, raise the thresholds in vguard.config.ts or split the task.',
        metadata: { writes, bash, elapsedMin, exceeded },
      };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};
