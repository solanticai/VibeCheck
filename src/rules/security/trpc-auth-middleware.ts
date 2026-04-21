import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const trpcAuthMiddleware: Rule = {
  id: 'security/trpc-auth-middleware',
  name: 'tRPC Auth Middleware',
  description:
    'Warns when tRPC mutations use publicProcedure where protectedProcedure should be used.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/trpc-auth-middleware';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'tsx'].includes(ext)) return { status: 'pass', ruleId };
    if (/\.(test|spec)\.tsx?$/.test(filePath)) return { status: 'pass', ruleId };

    // publicProcedure.mutation( — mutations should almost always be protected
    if (/\bpublicProcedure\b[^;]*\.mutation\s*\(/.test(content)) {
      return {
        status: 'warn',
        ruleId,
        message: 'tRPC mutation uses publicProcedure — mutations should usually require auth.',
        fix: 'Use protectedProcedure for mutations, reserving publicProcedure for anonymous reads (login, signup, public content).',
      };
    }
    return { status: 'pass', ruleId };
  },
};
