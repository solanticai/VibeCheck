import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const mongoNoUnboundProjection: Rule = {
  id: 'security/mongo-no-unbound-projection',
  name: 'Mongo No Unbound Projection',
  description:
    'Warns on Mongo queries that return the full document (no projection) on wide result sets.',
  severity: 'info',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/mongo-no-unbound-projection';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) return { status: 'pass', ruleId };
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    // .find({ ... }) with no .project, no .select, no second arg with non-empty projection
    const hasUnboundedFind = /\.find\s*\([^)]+\)\s*(?:\.limit\s*\(\s*\d{3,}|\.toArray)/.test(
      content,
    );
    if (hasUnboundedFind) {
      return {
        status: 'warn',
        ruleId,
        message: 'Mongo .find() with large/no limit and no projection — may leak sensitive fields.',
        fix: 'Add a projection: .find(filter, { name: 1, email: 1 }) or .select("name email").',
      };
    }
    return { status: 'pass', ruleId };
  },
};
