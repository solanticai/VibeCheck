import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const redisNoKeysStarInProd: Rule = {
  id: 'security/redis-no-keys-star-in-prod',
  name: 'Redis No KEYS *',
  description: 'Blocks Redis `KEYS *` / `KEYS <pattern>` in application code — blocks the server.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/redis-no-keys-star-in-prod';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!['ts', 'tsx', 'js', 'jsx', 'py'].includes(getExtension(filePath)))
      return { status: 'pass', ruleId };
    if (
      /\.keys\s*\(\s*['"`]\*['"`]\s*\)/.test(content) ||
      /\bcall\(\s*['"]KEYS['"]/.test(content)
    ) {
      return {
        status: 'block',
        ruleId,
        message: 'Redis KEYS command — O(N) scan that blocks the server.',
        fix: 'Use SCAN with a cursor for production traversal. KEYS is only safe for one-off admin commands on small DBs.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
