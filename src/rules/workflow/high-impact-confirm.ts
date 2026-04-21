import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';

const configSchema = z.object({
  patterns: z.array(z.string()).optional(),
  confirmEnvVar: z.string().optional(),
});

const DEFAULT_HIGH_IMPACT_PATTERNS: RegExp[] = [
  /\bDROP\s+(?:TABLE|DATABASE|SCHEMA)/i,
  /\bTRUNCATE\b/i,
  /\bgit\s+push\s+[^\n]*--force(?!-with-lease)/i,
  /\bgit\s+reset\s+--hard/i,
  /\bsupabase\s+db\s+reset/i,
  /\bterraform\s+(?:apply|destroy)\s+[^\n]*-auto-approve/i,
  /\bpulumi\s+(?:up|destroy)\s+[^\n]*--yes/i,
  /\baws\s+(?:s3\s+rm|rds\s+delete|ec2\s+terminate)/i,
  /\bkubectl\s+delete\s+(?:namespace|ns)\b/i,
  /\bkubectl\s+apply\s+[^\n]*--context[= ]\s*(?:prod|production|live)/i,
  /\bnpm\s+publish\b/i,
  /\byarn\s+publish\b/i,
  /\bpnpm\s+publish\b/i,
];

const DEFAULT_CONFIRM_ENV = 'VGUARD_CONFIRM';

/**
 * workflow/high-impact-confirm
 *
 * Blocks high-impact Bash commands (force push, drop table, prod deploy,
 * package publish) unless the `VGUARD_CONFIRM` env var is set to a truthy
 * value for the current session. Addresses OWASP Agentic ASI09
 * (Human-Agent Trust Exploitation): an AI with a persuasive rationale
 * cannot silently proceed on an irreversible action.
 */
export const highImpactConfirm: Rule = {
  id: 'workflow/high-impact-confirm',
  name: 'High-Impact Confirm',
  description: 'Blocks high-impact commands unless a human confirmation env var is set.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'workflow/high-impact-confirm';
    const command = (context.toolInput.command as string) ?? '';
    if (!command) return { status: 'pass', ruleId };

    const cfg = context.projectConfig.rules.get(ruleId);
    const customPatterns = cfg?.options?.patterns as string[] | undefined;
    const confirmEnv = (cfg?.options?.confirmEnvVar as string) ?? DEFAULT_CONFIRM_ENV;

    let patterns: RegExp[];
    try {
      patterns = customPatterns
        ? customPatterns.map((p) => new RegExp(p, 'i'))
        : DEFAULT_HIGH_IMPACT_PATTERNS;
    } catch {
      patterns = DEFAULT_HIGH_IMPACT_PATTERNS;
    }

    const hit = patterns.find((p) => p.test(command));
    if (!hit) return { status: 'pass', ruleId };

    const confirmed = process.env[confirmEnv];
    if (confirmed && confirmed !== '0' && confirmed !== 'false') {
      return { status: 'pass', ruleId };
    }

    return {
      status: 'block',
      ruleId,
      message: `High-impact command detected: matches /${hit.source}/. Human confirmation required.`,
      fix: `This operation is irreversible or production-affecting. Set ${confirmEnv}=1 in your shell for this command and re-run: e.g. "${confirmEnv}=1 <your command>".`,
      metadata: { pattern: hit.source, confirmEnv },
    };
  },
};
