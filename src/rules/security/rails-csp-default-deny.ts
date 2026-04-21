import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

export const railsCspDefaultDeny: Rule = {
  id: 'security/rails-csp-default-deny',
  name: 'Rails CSP Default Deny',
  description: 'Warns when content_security_policy.rb uses :unsafe_inline or :unsafe_eval.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  check: (context): RuleResult => {
    const ruleId = 'security/rails-csp-default-deny';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const p = normalizePath(filePath).toLowerCase();
    if (getExtension(filePath) !== 'rb' || !/content_security_policy/.test(p))
      return { status: 'pass', ruleId };
    if (/:unsafe_inline|:unsafe_eval/.test(content)) {
      return {
        status: 'warn',
        ruleId,
        message: 'Rails CSP allows unsafe_inline / unsafe_eval.',
        fix: 'Replace inline scripts with nonces / hashes. Those directives defeat the purpose of CSP.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
