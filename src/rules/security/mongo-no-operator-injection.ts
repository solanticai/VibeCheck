import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const INJECTION_PATTERNS: RegExp[] = [
  // .find({ ...req.body })
  /\.find(?:One)?\s*\(\s*\{[^}]*\.\.\.\s*req\.(?:body|query|params)\b/,
  // .updateOne({ filter }, { ...req.body })
  /\.update(?:One|Many)?\s*\([^)]*\{[^}]*\.\.\.\s*req\.(?:body|query|params)\b/,
  // db.collection.find(req.body)
  /\.(?:find(?:One)?|update(?:One|Many)?|delete(?:One|Many)?)\s*\(\s*req\.(?:body|query|params)\b/,
];

export const mongoNoOperatorInjection: Rule = {
  id: 'security/mongo-no-operator-injection',
  name: 'Mongo No Operator Injection',
  description: 'Blocks MongoDB queries that spread req.body/query/params into filter/update.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/mongo-no-operator-injection';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) return { status: 'pass', ruleId };
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    if (INJECTION_PATTERNS.some((p) => p.test(content))) {
      return {
        status: 'block',
        ruleId,
        message:
          'Mongo query spreads request input directly — enables operator injection ($ne, $gt, $where).',
        fix: 'Extract explicit fields: { email: req.body.email } not { ...req.body }. Validate with Zod before passing.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
