import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const redisNoEvalUserInput: Rule = {
  id: 'security/redis-no-eval-user-input',
  name: 'Redis No EVAL User Input',
  description: 'Blocks Redis EVAL/EVALSHA where the Lua script is dynamically built.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/redis-no-eval-user-input';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!['ts', 'tsx', 'js', 'jsx', 'py'].includes(getExtension(filePath)))
      return { status: 'pass', ruleId };
    if (
      /\b(?:redis|client|r)\.eval(?:sha)?\s*\(\s*[`"][^`"]*\$\{/.test(content) ||
      /\bcall\(\s*['"]EVAL/.test(content)
    ) {
      return {
        status: 'block',
        ruleId,
        message: 'Redis EVAL with interpolated Lua source — script injection risk.',
        fix: 'Use parameter-substituted Lua scripts: pass values via the KEYS/ARGV arrays, never interpolate into the script text.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
