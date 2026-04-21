import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const phoenixLiveviewCsrf: Rule = {
  id: 'security/phoenix-liveview-csrf',
  name: 'Phoenix LiveView CSRF',
  description: 'Warns when Phoenix endpoint.ex disables CSRF protection.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  check: (context): RuleResult => {
    const ruleId = 'security/phoenix-liveview-csrf';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (getExtension(filePath) !== 'ex' && getExtension(filePath) !== 'exs')
      return { status: 'pass', ruleId };
    if (/protect_from_forgery\s*:\s*false|skip_csrf_check/.test(content)) {
      return {
        status: 'warn',
        ruleId,
        message: 'Phoenix endpoint disables CSRF protection.',
        fix: 'Keep Plug.CSRFProtection in your pipeline. If a specific endpoint needs to skip CSRF, scope it narrowly.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
