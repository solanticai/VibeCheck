import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const zodRequireStripOrStrict: Rule = {
  id: 'quality/zod-require-strip-or-strict',
  name: 'Zod Require Strip or Strict',
  description:
    'Warns on top-level z.object() without .strict() or .strip() — unknown fields pass through.',
  severity: 'info',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'quality/zod-require-strip-or-strict';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'tsx'].includes(ext)) return { status: 'pass', ruleId };
    if (/\.(test|spec)\.tsx?$/.test(filePath)) return { status: 'pass', ruleId };

    // At least one top-level z.object — flag if none of the object chains strictify
    if (!/\bz\.object\s*\(/.test(content)) return { status: 'pass', ruleId };
    if (/\.(?:strict|strip|passthrough)\s*\(\s*\)/.test(content)) return { status: 'pass', ruleId };

    return {
      status: 'warn',
      ruleId,
      message:
        'Zod object schema without .strict() / .strip() / .passthrough() — policy is implicit.',
      fix: 'Chain .strict() on schemas that should reject unknown fields, or .strip() to silently drop them. Make the choice explicit.',
    };
  },
};
