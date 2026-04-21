import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const trpcRequireInputValidation: Rule = {
  id: 'security/trpc-require-input-validation',
  name: 'tRPC Require Input Validation',
  description: 'Warns when a tRPC procedure has no .input() / Zod validation.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/trpc-require-input-validation';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'tsx'].includes(ext)) return { status: 'pass', ruleId };
    if (/\.(test|spec)\.tsx?$/.test(filePath)) return { status: 'pass', ruleId };

    // Look for .procedure / publicProcedure / protectedProcedure with mutation/query but no input
    const proc = content.match(/\b\w+Procedure\b(?:[^;]*\.(?:query|mutation)\s*\()/g);
    if (!proc) return { status: 'pass', ruleId };
    if (/\.input\s*\(/.test(content)) return { status: 'pass', ruleId };
    return {
      status: 'warn',
      ruleId,
      message: 'tRPC procedure uses .query/.mutation without .input() — unvalidated input.',
      fix: 'Add .input(z.object({...})) before .query()/.mutation() so input is schema-validated.',
    };
  },
};
