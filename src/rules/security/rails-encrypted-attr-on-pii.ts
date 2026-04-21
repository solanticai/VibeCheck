import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const PII_FIELDS =
  /\b(?:ssn|social_security_number|date_of_birth|dob|tax_id|passport|national_id|credit_card)\b/i;

export const railsEncryptedAttrOnPii: Rule = {
  id: 'security/rails-encrypted-attr-on-pii',
  name: 'Rails Encrypted Attr on PII',
  description: 'Warns when Rails model has PII-looking column without encrypts declaration.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/rails-encrypted-attr-on-pii';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (getExtension(filePath) !== 'rb') return { status: 'pass', ruleId };
    if (!/class\s+\w+\s*<\s*ApplicationRecord/.test(content)) return { status: 'pass', ruleId };
    if (!PII_FIELDS.test(content)) return { status: 'pass', ruleId };
    if (/\bencrypts\s+:[a-z_]+/.test(content)) return { status: 'pass', ruleId };
    return {
      status: 'warn',
      ruleId,
      message: 'Rails model has a PII-shaped attribute but no `encrypts` declaration.',
      fix: 'Add `encrypts :ssn` (etc.) to leverage Rails built-in attribute encryption.',
    };
  },
};
