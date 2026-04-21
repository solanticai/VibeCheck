import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const grpcDeadlinePropagation: Rule = {
  id: 'security/grpc-deadline-propagation',
  name: 'gRPC Deadline Propagation',
  description: 'Warns when gRPC client calls do not set a deadline.',
  severity: 'info',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/grpc-deadline-propagation';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!['ts', 'tsx', 'js', 'jsx'].includes(getExtension(filePath)))
      return { status: 'pass', ruleId };
    // gRPC client call missing deadline option
    if (/\b\w+Client\.(?:\w+)\s*\([^)]*\)/.test(content) && !/deadline\s*:/.test(content)) {
      return {
        status: 'warn',
        ruleId,
        message: 'gRPC client call has no deadline — risk of hung calls.',
        fix: 'Always set a deadline: `{ deadline: Date.now() + 5000 }`.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
