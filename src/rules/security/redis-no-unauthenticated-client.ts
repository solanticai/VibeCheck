import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const redisNoUnauthenticatedClient: Rule = {
  id: 'security/redis-no-unauthenticated-client',
  name: 'Redis No Unauthenticated Client',
  description:
    'Warns when Redis client is constructed against a prod-looking host with no password.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/redis-no-unauthenticated-client';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!['ts', 'tsx', 'js', 'jsx', 'py'].includes(getExtension(filePath)))
      return { status: 'pass', ruleId };
    // createClient({ url: "redis://host:6379" }) without password
    if (/redis:\/\/[^"'@]+:\d+/.test(content) && !/redis:\/\/[^"']*:[^"']+@/.test(content)) {
      if (/createClient|Redis\s*\(|ioredis/.test(content)) {
        return {
          status: 'warn',
          ruleId,
          message: 'Redis client URL has no password — verify this is only a local dev instance.',
          fix: 'Use redis://:PASSWORD@host:6379 or set the password option explicitly. Redis with no auth on a non-loopback host is a standing RCE via EVAL.',
        };
      }
    }
    return { status: 'pass', ruleId };
  },
};
