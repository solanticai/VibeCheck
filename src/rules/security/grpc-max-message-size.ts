import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const grpcMaxMessageSize: Rule = {
  id: 'security/grpc-max-message-size',
  name: 'gRPC Max Message Size',
  description: 'Warns when gRPC server does not configure max receive message size.',
  severity: 'info',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/grpc-max-message-size';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!['ts', 'tsx', 'js', 'jsx'].includes(getExtension(filePath)))
      return { status: 'pass', ruleId };
    if (!/new\s+(?:grpc\.)?Server\s*\(/.test(content)) return { status: 'pass', ruleId };
    if (/grpc\.max_receive_message_length|'grpc\.max_receive_message_length'/.test(content)) {
      return { status: 'pass', ruleId };
    }
    return {
      status: 'warn',
      ruleId,
      message: 'gRPC Server without max_receive_message_length — unbounded payload DoS risk.',
      fix: 'Pass { "grpc.max_receive_message_length": 4 * 1024 * 1024 } (or your limit) when constructing the server.',
    };
  },
};
