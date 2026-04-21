import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';

const configSchema = z.object({
  allowedHosts: z.array(z.string()).optional(),
  denyByDefault: z.boolean().optional(),
});

const URL_PATTERNS: RegExp[] = [
  /\b(?:curl|wget|fetch|http|axios|got|undici|gh\s+api)\b\s+[^\n|;&]*?https?:\/\/([a-zA-Z0-9.-]+)/gi,
  /https?:\/\/([a-zA-Z0-9.-]+)/g,
];

function extractHosts(command: string): string[] {
  const hosts = new Set<string>();
  for (const re of URL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(command)) !== null) {
      if (m[1]) hosts.add(m[1].toLowerCase());
    }
  }
  return [...hosts];
}

/**
 * security/egress-allowlist
 *
 * Warns (or blocks) when a Bash / WebFetch command targets a host not in
 * the configured allowlist. Addresses OWASP LLM02 (data exfil) and Agentic
 * ASI10 (rogue-agent phone-home). Default is warn so teams opt-in to
 * strict denial.
 */
export const egressAllowlist: Rule = {
  id: 'security/egress-allowlist',
  name: 'Egress Allowlist',
  description: 'Warns when outbound network calls target hosts outside the configured allowlist.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Bash', 'WebFetch'] },
  configSchema,
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/egress-allowlist';
    const command =
      (context.toolInput.command as string) ?? (context.toolInput.url as string) ?? '';
    if (!command) return { status: 'pass', ruleId };

    const cfg = context.projectConfig.rules.get(ruleId);
    const allowed = ((cfg?.options?.allowedHosts as string[]) ?? []).map((h) => h.toLowerCase());
    if (allowed.length === 0) return { status: 'pass', ruleId };

    const hosts = extractHosts(command);
    if (hosts.length === 0) return { status: 'pass', ruleId };

    const denied = hosts.filter((h) => !allowed.some((a) => h === a || h.endsWith('.' + a)));
    if (denied.length === 0) return { status: 'pass', ruleId };

    return {
      status: 'warn',
      ruleId,
      message: `Egress to non-allowlisted host(s): ${denied.join(', ')}.`,
      fix: `Add the host(s) to security/egress-allowlist.options.allowedHosts in vguard.config.ts if the call is legitimate, or use an allowlisted proxy/mirror.`,
      metadata: { denied, allowed },
    };
  },
};
