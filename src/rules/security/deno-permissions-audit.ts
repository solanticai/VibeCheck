import type { Rule, RuleResult } from '../../types.js';

export const denoPermissionsAudit: Rule = {
  id: 'security/deno-permissions-audit',
  name: 'Deno Permissions Audit',
  description: 'Blocks `deno run -A` / `--allow-all` — grants every permission to the script.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Bash'] },
  check: (context): RuleResult => {
    const ruleId = 'security/deno-permissions-audit';
    const command = (context.toolInput.command as string) ?? '';
    if (!command) return { status: 'pass', ruleId };
    if (/\bdeno\s+(?:run|test|bench|task)\b[^\n]*(?:-A\b|--allow-all\b)/.test(command)) {
      return {
        status: 'block',
        ruleId,
        message: 'deno -A / --allow-all grants every permission to the script.',
        fix: 'Specify only the permissions you need: --allow-net=<host> --allow-read=./data etc.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
