import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

export const nestjsThrottlerConfigured: Rule = {
  id: 'security/nestjs-throttler-configured',
  name: 'NestJS Throttler Configured',
  description: 'Warns when NestJS app module does not import ThrottlerModule.',
  severity: 'info',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/nestjs-throttler-configured';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    const ext = getExtension(filePath);
    if (!['ts', 'js'].includes(ext)) return { status: 'pass', ruleId };
    const p = normalizePath(filePath).toLowerCase();
    if (!/\/app\.module\.(?:ts|js)$/.test(p)) return { status: 'pass', ruleId };
    if (/ThrottlerModule/.test(content)) return { status: 'pass', ruleId };
    return {
      status: 'warn',
      ruleId,
      message: 'NestJS app.module does not import ThrottlerModule — no rate limiting.',
      fix: 'Add ThrottlerModule.forRoot({...}) to your imports. Install with `npm i @nestjs/throttler`.',
    };
  },
};
