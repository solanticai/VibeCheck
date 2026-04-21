import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const grpcAuthInterceptor: Rule = {
  id: 'security/grpc-auth-interceptor',
  name: 'gRPC Auth Interceptor',
  description: 'Warns when a gRPC server is constructed with no authentication interceptor.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/grpc-auth-interceptor';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!['ts', 'tsx', 'js', 'jsx'].includes(getExtension(filePath)))
      return { status: 'pass', ruleId };
    if (!/new\s+(?:grpc\.)?Server\s*\(/.test(content)) return { status: 'pass', ruleId };
    if (/interceptor|addService.*middleware|authMiddleware/i.test(content))
      return { status: 'pass', ruleId };
    return {
      status: 'warn',
      ruleId,
      message: 'gRPC Server without an auth interceptor.',
      fix: 'Attach an auth interceptor that validates the call metadata (e.g. JWT in "authorization") before dispatching.',
    };
  },
};
