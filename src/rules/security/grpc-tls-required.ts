import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const grpcTlsRequired: Rule = {
  id: 'security/grpc-tls-required',
  name: 'gRPC TLS Required',
  description: 'Warns when a gRPC server is created with insecure credentials.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/grpc-tls-required';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!['ts', 'tsx', 'js', 'jsx', 'py', 'go'].includes(getExtension(filePath)))
      return { status: 'pass', ruleId };
    if (
      /createInsecure\s*\(\s*\)/.test(content) ||
      /grpc\.ServerCredentials\.createInsecure/.test(content)
    ) {
      return {
        status: 'warn',
        ruleId,
        message: 'gRPC server using insecure (plaintext) credentials.',
        fix: 'Use ServerCredentials.createSsl(...) with real certs, or terminate TLS at a reverse proxy.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
