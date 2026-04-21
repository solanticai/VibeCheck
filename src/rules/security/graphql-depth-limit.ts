import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const graphqlDepthLimit: Rule = {
  id: 'security/graphql-depth-limit',
  name: 'GraphQL Depth Limit',
  description: 'Warns when GraphQL server setup has no depth-limiting plugin.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/graphql-depth-limit';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!['ts', 'tsx', 'js', 'jsx'].includes(getExtension(filePath)))
      return { status: 'pass', ruleId };
    if (!/\b(?:ApolloServer|createYoga|createSchema|mercurius)\s*\(/.test(content)) {
      return { status: 'pass', ruleId };
    }
    if (/depthLimit|maxDepth|graphql-depth-limit|validation.*depth/i.test(content)) {
      return { status: 'pass', ruleId };
    }
    return {
      status: 'warn',
      ruleId,
      message:
        'GraphQL server without a depth-limiting plugin — vulnerable to recursive query DoS.',
      fix: 'Add graphql-depth-limit (or @envelop/depth-limit) with a reasonable maxDepth (e.g. 7).',
    };
  },
};
