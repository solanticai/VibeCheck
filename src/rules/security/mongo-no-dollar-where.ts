import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const mongoNoDollarWhere: Rule = {
  id: 'security/mongo-no-dollar-where',
  name: 'Mongo No $where',
  description: 'Blocks MongoDB $where operator — JavaScript execution on the DB server.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/mongo-no-dollar-where';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) return { status: 'pass', ruleId };
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    if (/["']\$where["']\s*:/.test(content) || /\$where\s*:\s*["'`]/.test(content)) {
      return {
        status: 'block',
        ruleId,
        message: 'MongoDB $where operator detected — executes server-side JavaScript.',
        fix: 'Rewrite the query using standard operators ($eq, $gt, $in, etc.) or aggregation.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
