import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const graphqlComplexityLimit: Rule = {
  id: 'security/graphql-complexity-limit',
  name: 'GraphQL Complexity Limit',
  description: 'Warns when GraphQL server has no query complexity limiter.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/graphql-complexity-limit';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!['ts', 'tsx', 'js', 'jsx'].includes(getExtension(filePath)))
      return { status: 'pass', ruleId };
    if (!/\b(?:ApolloServer|createYoga|createSchema|mercurius)\s*\(/.test(content)) {
      return { status: 'pass', ruleId };
    }
    if (/graphql-query-complexity|maxComplexity|costAnalysis/i.test(content)) {
      return { status: 'pass', ruleId };
    }
    return {
      status: 'warn',
      ruleId,
      message: 'GraphQL server without a query-complexity limiter.',
      fix: 'Add graphql-query-complexity or @envelop/operation-field-permissions with a maxComplexity ceiling.',
    };
  },
};
