import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const zodServerActionInput: Rule = {
  id: 'security/zod-server-action-input',
  name: 'Zod Server Action Input',
  description:
    'Warns when a Next.js server action accepts FormData without a Zod schema on the input.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/zod-server-action-input';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'tsx'].includes(ext)) return { status: 'pass', ruleId };
    if (/\.(test|spec)\.tsx?$/.test(filePath)) return { status: 'pass', ruleId };

    const hasUseServer = /^['"]use server['"]/m.test(content);
    if (!hasUseServer) return { status: 'pass', ruleId };

    const hasFormDataParam = /\b(?:form(?:Data)?|fd|data)\s*:\s*FormData\b/.test(content);
    if (!hasFormDataParam) return { status: 'pass', ruleId };

    const hasZodValidation =
      /\bz\.(?:object|string|number|boolean)/.test(content) ||
      /\.safeParse\s*\(/.test(content) ||
      /\.parse\s*\(/.test(content);
    if (hasZodValidation) return { status: 'pass', ruleId };

    return {
      status: 'warn',
      ruleId,
      message: 'Server action accepts FormData without a Zod schema.',
      fix: 'Define a Zod schema and call .safeParse(Object.fromEntries(form)). Reject on error before doing anything else.',
    };
  },
};
