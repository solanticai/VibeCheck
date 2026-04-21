import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

export const graphqlResolverInputValidation: Rule = {
  id: 'security/graphql-resolver-input-validation',
  name: 'GraphQL Resolver Input Validation',
  description: 'Warns when a GraphQL resolver passes args directly to DB/exec sinks.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/graphql-resolver-input-validation';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const p = normalizePath(filePath).toLowerCase();
    if (!/\/resolvers?\//.test(p) && !/\bresolvers?\.(?:ts|js)$/.test(p)) {
      return { status: 'pass', ruleId };
    }
    if (!['ts', 'tsx', 'js', 'jsx'].includes(getExtension(filePath)))
      return { status: 'pass', ruleId };
    // resolver signature -> args -> direct use in find/exec
    if (
      /\(parent[^,]*,\s*args[^,]*,/.test(content) &&
      /\b(?:exec|find|query|raw)\s*\(\s*args\./.test(content)
    ) {
      return {
        status: 'warn',
        ruleId,
        message: 'GraphQL resolver passes args directly into exec/find/raw sink.',
        fix: 'Validate args with Zod or @graphql-tools/utils before using them in side-effectful calls.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
