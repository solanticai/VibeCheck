import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const zodNoAnySchema: Rule = {
  id: 'quality/zod-no-any-schema',
  name: 'Zod No Any Schema',
  description: 'Warns on z.any() and z.unknown() — those defeat the purpose of schema validation.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'quality/zod-no-any-schema';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'tsx'].includes(ext)) return { status: 'pass', ruleId };
    if (/\.(test|spec)\.tsx?$/.test(filePath)) return { status: 'pass', ruleId };

    if (/\bz\.any\s*\(\s*\)/.test(content)) {
      return {
        status: 'warn',
        ruleId,
        message: 'z.any() in Zod schema — defeats validation.',
        fix: 'Describe the actual shape: z.object({ ... }), z.union([...]), z.record(z.string(), z.unknown()) — or narrow further.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
