import type { Rule, RuleResult } from '../../types.js';

const PROD_MARKERS: RegExp[] = [
  /\bAWS_PROFILE\s*=\s*(?:production|prod|live|master|main)\b/i,
  /\bkubectl\b[^\n]*?--context[= ]\s*(?:production|prod|live|master|main)\b/i,
  /\bkubectl\b[^\n]*?--namespace[= ]\s*(?:production|prod|live)\b/i,
  /\b(?:DATABASE_URL|PG_URL|MONGO_URL)\s*=\s*[^ \n]*(?:prod|production|live|rds\.amazonaws|\.supabase\.co|\.neon\.tech)/i,
  /\bgcloud\s+config\s+set\s+project\s+[^\s]*(?:prod|production|live)/i,
  /\bvercel\s+--prod\b/i,
];

const DESTRUCTIVE_VERBS: RegExp[] = [
  /\brm\s+-[a-z]*[rR]/i,
  /\bDROP\s+(?:TABLE|DATABASE|SCHEMA)/i,
  /\bDELETE\s+FROM/i,
  /\bTRUNCATE/i,
  /\b(?:aws|gcloud)\b[^\n]*?\b(?:delete|terminate|destroy|rm)\b/i,
  /\bkubectl\b[^\n]*?\bdelete\b/i,
  /\bsupabase\s+db\s+reset/i,
  /\bterraform\s+destroy/i,
  /\bpulumi\s+destroy/i,
  /\bgh\s+repo\s+delete/i,
];

/**
 * security/credential-context-guard
 *
 * Blocks Bash commands where a production-context marker co-occurs with a
 * destructive/write verb. AI agents routinely inherit ambient prod creds
 * (AWS_PROFILE, kubectl context, prod DATABASE_URL) and invoke destructive
 * commands in the wrong environment. Addresses OWASP Agentic ASI03
 * (Identity & Privilege Abuse).
 */
export const credentialContextGuard: Rule = {
  id: 'security/credential-context-guard',
  name: 'Credential Context Guard',
  description:
    'Blocks destructive/write operations when ambient production credentials are present.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'security/credential-context-guard';
    const command = (context.toolInput.command as string) ?? '';
    if (!command) return { status: 'pass', ruleId };

    const prodHit = PROD_MARKERS.find((p) => p.test(command));
    if (!prodHit) return { status: 'pass', ruleId };

    const destructiveHit = DESTRUCTIVE_VERBS.find((p) => p.test(command));
    if (!destructiveHit) return { status: 'pass', ruleId };

    return {
      status: 'block',
      ruleId,
      message: `Production credentials appear combined with a destructive/write verb. This is the ASI03 pattern that turns a mis-targeted command into a prod incident.`,
      fix: `Split the operation: switch to a non-prod context first (change kube context, unset AWS_PROFILE, point DATABASE_URL at staging), or run the command manually after human review.`,
      metadata: { prodMarker: prodHit.source, destructiveVerb: destructiveHit.source },
    };
  },
};
