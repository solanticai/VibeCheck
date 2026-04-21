import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const graphqlNoIntrospectionInProd: Rule = {
  id: 'security/graphql-no-introspection-in-prod',
  name: 'GraphQL No Introspection in Prod',
  description:
    'Warns when GraphQL server is constructed with introspection unconditionally enabled.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/graphql-no-introspection-in-prod';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!['ts', 'tsx', 'js', 'jsx'].includes(getExtension(filePath)))
      return { status: 'pass', ruleId };
    if (/introspection\s*:\s*true/.test(content)) {
      if (/NODE_ENV|isDev|development/.test(content)) return { status: 'pass', ruleId };
      return {
        status: 'warn',
        ruleId,
        message:
          'GraphQL introspection:true without NODE_ENV guard — exposes schema in production.',
        fix: 'Gate: introspection: process.env.NODE_ENV !== "production".',
      };
    }
    return { status: 'pass', ruleId };
  },
};
